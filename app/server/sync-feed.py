#!/usr/bin/env python3
"""Puxa a release mais nova do app (GitHub) para o feed de atualização.

O servidor está na rede local e o GitHub não alcança ele; então é o servidor
que pergunta. Roda no cron (ver server/README.md), sem dependências:

  */3 * * * * /usr/bin/python3 /srv/myscreen/app/server/sync-feed.py >> $HOME/myscreen-sync-feed.log 2>&1

Só avança o feed (nunca volta versão), confere o sha512 do instalador contra o
latest.yml e troca o latest.yml por último, de forma atômica: um cliente que lê
o feed novo sempre encontra o .exe que ele aponta. Uma versão publicada à mão
(`npm run publish:desktop`) igual ou maior é deixada como está.
"""

import base64
import fcntl
import hashlib
import json
import os
import re
import sys
import time
import urllib.request

REPO = os.environ.get("MYSCREEN_REPO", "riique/MyScreen")
FEED = os.environ.get("MYSCREEN_FEED_DIR", "/opt/myscreen/releases")
# Fora da pasta servida pelo Caddy: nada de lock ou log em /downloads/.
LOCK = os.environ.get("MYSCREEN_FEED_LOCK", "/tmp/myscreen-sync-feed.lock")
TAG = re.compile(r"^v(\d+)\.(\d+)\.(\d+)$")


def log(msg: str) -> None:
    print(time.strftime("%Y-%m-%d %H:%M:%S"), msg, flush=True)


def get(url: str, accept: str = "application/octet-stream"):
    req = urllib.request.Request(url, headers={"Accept": accept, "User-Agent": "myscreen-feed-sync"})
    return urllib.request.urlopen(req, timeout=60)


def version_tuple(v: str) -> tuple:
    m = re.match(r"^(\d+)\.(\d+)\.(\d+)", v.strip())
    return tuple(int(x) for x in m.groups()) if m else (0, 0, 0)


def feed_version() -> tuple:
    try:
        with open(os.path.join(FEED, "latest.yml"), encoding="utf-8") as f:
            m = re.search(r"^version:\s*(\S+)", f.read(), re.M)
            return version_tuple(m.group(1)) if m else (0, 0, 0)
    except FileNotFoundError:
        return (0, 0, 0)


def newest_release() -> dict | None:
    with get(f"https://api.github.com/repos/{REPO}/releases?per_page=30", "application/vnd.github+json") as r:
        releases = json.load(r)
    best = None
    for rel in releases:
        m = TAG.match(rel.get("tag_name", ""))
        if not m or rel.get("draft") or rel.get("prerelease"):
            continue
        ver = tuple(int(x) for x in m.groups())
        if best is None or ver > best[0]:
            best = (ver, rel)
    return best and {"version": best[0], **best[1]}


def download(url: str, dest: str) -> None:
    tmp = dest + ".part"
    with get(url) as r, open(tmp, "wb") as f:
        while chunk := r.read(1 << 20):
            f.write(chunk)
    os.replace(tmp, dest)


def main() -> int:
    lock = open(LOCK, "w")
    try:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        return 0  # outra rodada ainda baixando

    rel = newest_release()
    if not rel:
        return 0
    current = feed_version()
    if rel["version"] <= current:
        return 0

    ver = ".".join(map(str, rel["version"]))
    assets = {a["name"]: a["browser_download_url"] for a in rel.get("assets", [])}
    exe = f"MyScreen-Setup-{ver}.exe"
    needed = [exe, exe + ".blockmap", "latest.yml"]
    missing = [n for n in needed if n not in assets]
    if missing:
        log(f"v{ver}: release sem {', '.join(missing)}; tento de novo depois")
        return 0

    log(f"feed {'.'.join(map(str, current))} → {ver}: baixando")
    with get(assets["latest.yml"]) as r:
        feed_text = r.read().decode("utf-8")
    m = re.search(r"^version:\s*(\S+)", feed_text, re.M)
    s = re.search(r"^sha512:\s*(\S+)", feed_text, re.M)
    if not m or version_tuple(m.group(1)) != rel["version"] or not s or exe not in feed_text:
        log(f"v{ver}: latest.yml não confere com a release; abortado")
        return 1

    # Binários primeiro, feed por último.
    download(assets[exe], os.path.join(FEED, exe))
    download(assets[exe + ".blockmap"], os.path.join(FEED, exe + ".blockmap"))

    h = hashlib.sha512()
    with open(os.path.join(FEED, exe), "rb") as f:
        while chunk := f.read(1 << 20):
            h.update(chunk)
    if base64.b64encode(h.digest()).decode() != s.group(1):
        log(f"v{ver}: sha512 do instalador não confere; feed mantido")
        os.remove(os.path.join(FEED, exe))
        return 1

    latest_exe = os.path.join(FEED, "MyScreen-Setup-latest.exe")
    with open(os.path.join(FEED, exe), "rb") as src, open(latest_exe + ".part", "wb") as dst:
        while chunk := src.read(1 << 20):
            dst.write(chunk)
    os.replace(latest_exe + ".part", latest_exe)

    tmp = os.path.join(FEED, "latest.yml.tmp")
    with open(tmp, "w", encoding="utf-8") as f:
        f.write(feed_text)
    os.chmod(tmp, 0o644)
    os.replace(tmp, os.path.join(FEED, "latest.yml"))
    log(f"feed atualizado para {ver}")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as e:  # cron: uma linha no log, tenta de novo na próxima
        log(f"falhou: {e!r}")
        sys.exit(1)
