import { beforeEach, describe, expect, it } from "vitest";
import { RemoteGate, type GateDeps, type HostShare, type InjectCommand, type UnattendedVerifier } from "../src/main/remoteGate";
import type { Rect } from "@shared/remote/geometry";

import {
  CLIP_FIRST,
  CLIP_LAST,
  clipChunks,
  encodeInput,
  sessionTag,
  type Ctl,
  type InputEvent,
} from "@shared/remote/protocol";

const REQ = "AAECAwQFBgcICQoLDA0ODw";
const SESSION = "EBESExQVFhcYGRobHB0eHw";
const ana = { identity: "Ana-1a2b3c4d", sid: "PA_ana1", name: "Ana" };
const display: Rect = { x: -1920, y: 0, w: 1920, h: 1080 };

function setup() {
  let now = 0;
  const timers = new Map<number, { fn: () => void; at: number }>();
  let timerId = 0;
  const sent: { to: string; msg: Ctl }[] = [];
  const injected: InjectCommand[] = [];
  const log: string[] = [];
  const consents: string[] = [];
  const clipboard: string[] = [];
  const world = {
    share: { kind: "screen", sourceName: "Monitor 1", trackSid: "TR_screen", physical: display } as HostShare | null,
    disabled: false,
    unattended: null as UnattendedVerifier | null,
  };
  let nextId = 0;
  const ids = [SESSION, "ICEiIyQlJicoKSorLC0uLw", "MDEyMzQ1Njc4OUFCQ0RFRg"];
  const deps: GateDeps = {
    now: () => now,
    setTimer: (fn, ms) => {
      timers.set(++timerId, { fn, at: now + ms });
      return timerId;
    },
    clearTimer: (h) => timers.delete(h as number),
    randomId: () => ids[nextId++ % ids.length],
    share: () => world.share,
    acceptsRequests: () => (world.disabled ? { ok: false, reason: "disabled" } : { ok: true }),
    unattendedAuth: () => world.unattended,
    send: (to, msg) => sent.push({ to, msg }),
    inject: (cmd) => {
      injected.push(cmd);
      log.push(`inject:${cmd.t}`);
    },
    setClipboard: (text) => {
      clipboard.push(text);
      log.push("clipboard");
    },
    askConsent: (req) => consents.push(req.reqId),
    closeConsent: () => {},
    sessionChanged: (info) => log.push(info ? "session:on" : "session:off"),
  };
  const gate = new RemoteGate(deps);
  const advance = (ms: number) => {
    now += ms;
    for (const [id, t] of [...timers]) {
      if (t.at <= now) {
        timers.delete(id);
        t.fn();
      }
    }
  };
  let seq = 0;
  const input = (ev: InputEvent, from = ana, s = ++seq) => gate.handleInput(from, encodeInput(sessionTag(SESSION), s, ev));
  const grant = () => {
    gate.handleCtl(ana, { t: "request", v: 1, reqId: REQ });
    gate.decide(REQ, true);
  };
  return { gate, sent, injected, log, clipboard, consents, world, advance, input, grant, setSeq: (v: number) => (seq = v) };
}

let t: ReturnType<typeof setup>;
beforeEach(() => {
  t = setup();
});

describe("consentimento", () => {
  it("restringe pedidos administrativos à sessão ativa e ao SID autorizado", () => {
    expect(t.gate.canUseAdmin(ana, SESSION)).toBe(false);
    t.grant();
    expect(t.gate.canUseAdmin(ana, SESSION)).toBe(true);
    expect(t.gate.canUseAdmin(ana, REQ)).toBe(false);
    expect(t.gate.canUseAdmin({ ...ana, sid: "PA_ana2" }, SESSION)).toBe(false);
    t.gate.setPaused(true);
    expect(t.gate.canUseAdmin(ana, SESSION)).toBe(false);
    t.gate.setPaused(false);
    t.gate.peerSeen(ana.identity, "PA_ana2");
    expect(t.gate.canUseAdmin(ana, SESSION)).toBe(false);
  });
  it("pedido normal cria sessão não-direta sem bloquear foco no MyScreen", () => {
    const u = setup();
    u.grant();
    expect(u.sent.map((m) => m.msg.t)).toEqual(["grant"]);
    expect(u.gate.active?.direct).toBe(false);
  });
  it("pedido abre o diálogo; sem clique não há sessão", () => {
    t.gate.handleCtl(ana, { t: "request", v: 1, reqId: REQ });
    expect(t.consents).toEqual([REQ]);
    expect(t.gate.active).toBeNull();
    expect(t.input({ t: "move", x: 1, y: 1 })).toBe(false);
  });
  it("expira em 30 s como recusa, com espera antes de pedir de novo", () => {
    t.gate.handleCtl(ana, { t: "request", v: 1, reqId: REQ });
    t.advance(30_000);
    expect(t.sent.at(-1)?.msg).toEqual({ t: "deny", reqId: REQ, reason: "timeout" });
    t.gate.handleCtl(ana, { t: "request", v: 1, reqId: SESSION });
    expect(t.sent.at(-1)?.msg).toMatchObject({ t: "deny", reason: "cooldown" });
    t.advance(30_000);
    t.gate.handleCtl(ana, { t: "request", v: 1, reqId: SESSION });
    expect(t.consents).toHaveLength(2);
  });
  it("recusado, desligado, sem tela ou com janela", () => {
    t.gate.handleCtl(ana, { t: "request", v: 1, reqId: REQ });
    t.gate.decide(REQ, false);
    expect(t.sent.at(-1)?.msg).toMatchObject({ t: "deny", reason: "refused" });

    const u = setup();
    u.world.disabled = true;
    u.gate.handleCtl(ana, { t: "request", v: 1, reqId: REQ });
    expect(u.sent.at(-1)?.msg).toMatchObject({ t: "deny", reason: "disabled" });

    const w = setup();
    w.world.share = { kind: "window", sourceName: "Bloco", trackSid: "TR_w", physical: null };
    w.gate.handleCtl(ana, { t: "request", v: 1, reqId: REQ });
    expect(w.sent.at(-1)?.msg).toMatchObject({ t: "deny", reason: "not-sharing" });
  });
  it("um controlador por vez", () => {
    t.grant();
    t.gate.handleCtl({ identity: "Bia-00000000", sid: "PA_b", name: "Bia" }, { t: "request", v: 1, reqId: REQ });
    expect(t.sent.at(-1)).toEqual({ to: "Bia-00000000", msg: { t: "deny", reqId: REQ, reason: "busy" } });
  });
  it("permitir manda grant com a trilha e o tamanho do monitor", () => {
    t.grant();
    expect(t.sent.at(-1)?.msg).toEqual({ t: "grant", reqId: REQ, sessionId: SESSION, trackSid: "TR_screen", width: 1920, height: 1080 });
    expect(t.gate.active?.identity).toBe(ana.identity);
  });
});

describe("portão de input", () => {
  beforeEach(() => t.grant());

  it("mapeia para o pixel físico do monitor compartilhado", () => {
    expect(t.input({ t: "button", button: 0, down: true, x: 65535, y: 0 })).toBe(true);
    expect(t.injected.at(-1)).toEqual({ t: "button", button: 0, down: true, px: -1, py: 0 });
  });
  it("identidade certa com SID errado é descartada", () => {
    expect(t.input({ t: "move", x: 1, y: 1 }, { ...ana, sid: "PA_outro" })).toBe(false);
    expect(t.input({ t: "move", x: 1, y: 1 }, { identity: "Bia", sid: "PA_ana1", name: "Ana" })).toBe(false);
    expect(t.injected).toHaveLength(0);
  });
  it("tag de sessão velha é descartada", () => {
    expect(t.gate.handleInput(ana, encodeInput(123, 1, { t: "move", x: 1, y: 1 }))).toBe(false);
  });
  it("MOVE mais velho que o último evento aplicado é descartado", () => {
    t.setSeq(10);
    expect(t.input({ t: "move", x: 5, y: 5 }, ana, 10)).toBe(true);
    expect(t.input({ t: "move", x: 4, y: 4 }, ana, 9)).toBe(false);
    expect(t.input({ t: "move", x: 6, y: 6 }, ana, 11)).toBe(true);
  });
  it("clique e roda chegam ao utility (a zona protegida exata é checada lá)", () => {
    expect(t.input({ t: "button", button: 0, down: true, x: 0, y: 0 })).toBe(true);
    expect(t.input({ t: "wheel", dx: 0, dy: 120, x: 0, y: 0 })).toBe(true);
    expect(t.injected.at(-1)).toEqual({ t: "wheel", dx: 0, dy: 120, px: -1920, py: 0 });
  });
  it("clique bloqueado numa janela do MyScreen avisa o controlador, sem inundar", () => {
    t.gate.blocked();
    expect(t.sent.at(-1)).toEqual({ to: ana.identity, msg: { t: "blocked", sessionId: SESSION } });
    const n = t.sent.length;
    t.advance(500);
    t.gate.blocked();
    expect(t.sent.length).toBe(n);
    t.advance(1500);
    t.gate.blocked();
    expect(t.sent.length).toBe(n + 1);
  });
  it("soltar só o botão que foi apertado por nós", () => {
    expect(t.input({ t: "button", button: 0, down: true, x: 65535, y: 65535 })).toBe(true);
    expect(t.input({ t: "button", button: 0, down: false, x: 0, y: 0 })).toBe(true);
    expect(t.input({ t: "button", button: 2, down: false, x: 65535, y: 65535 })).toBe(false);
  });
  it("teclas e texto entram normalmente (inclusive sobre o MyScreen)", () => {
    expect(t.input({ t: "key", scancode: 0x1e, down: true })).toBe(true);
    expect(t.input({ t: "text", text: "ok" })).toBe(true);
    expect(t.injected.slice(-2)).toEqual([
      { t: "key", scancode: 0x1e, down: true },
      { t: "text", text: "ok" },
    ]);
  });
  it("estouro do balde: descarta movimento; em evento confiável, revoga", () => {
    let moves = 0;
    for (let i = 0; i < 600; i++) if (t.input({ t: "move", x: i, y: i })) moves++;
    expect(moves).toBeLessThan(480);
    for (let i = 0; i < 600 && t.gate.active; i++) t.input({ t: "key", scancode: 0x1e, down: i % 2 === 0 });
    expect(t.gate.active).toBeNull();
    expect(t.sent.at(-1)?.msg).toEqual({ t: "revoke", sessionId: SESSION, reason: "error" });
  });
  it("pausado: só o que solta passa", () => {
    t.input({ t: "key", scancode: 0x1d, down: true });
    t.gate.setPaused(true);
    expect(t.injected.at(-1)).toEqual({ t: "release" });
    expect(t.input({ t: "move", x: 1, y: 1 })).toBe(false);
    expect(t.input({ t: "key", scancode: 0x1e, down: true })).toBe(false);
    expect(t.sent.at(-1)?.msg).toEqual({ t: "state", sessionId: SESSION, paused: true, why: "user" });
  });
  it("a pessoa do PC mexe no mouse: o controle volta para ela e retorna quando ela para", () => {
    t.input({ t: "button", button: 0, down: true, x: 10, y: 10 });
    t.gate.localMouse();
    expect(t.injected.at(-1)).toEqual({ t: "release" });
    expect(t.sent.at(-1)?.msg).toEqual({ t: "state", sessionId: SESSION, paused: true, why: "local-input" });
    expect(t.input({ t: "move", x: 1, y: 1 })).toBe(false);
    expect(t.input({ t: "button", button: 0, down: true, x: 1, y: 1 })).toBe(false);
    // Continua mexendo: o prazo estica.
    t.advance(800);
    t.gate.localMouse();
    t.advance(800);
    expect(t.input({ t: "move", x: 2, y: 2 })).toBe(false);
    t.advance(300);
    expect(t.sent.at(-1)?.msg).toEqual({ t: "state", sessionId: SESSION, paused: false });
    expect(t.input({ t: "move", x: 3, y: 3 })).toBe(true);
  });
});

describe("revogação", () => {
  beforeEach(() => t.grant());

  const triggers: [string, () => void, string][] = [
    ["parar", () => t.gate.end("user"), "user"],
    ["pânico", () => t.gate.end("panic"), "panic"],
    ["bloqueio", () => t.gate.end("locked"), "locked"],
    ["compartilhamento parou", () => {
      t.world.share = null;
      t.gate.shareChanged();
    }, "share-ended"],
    ["trocou de tela", () => {
      t.world.share = { kind: "screen", sourceName: "Monitor 2", trackSid: "TR_outra", physical: display };
      t.gate.shareChanged();
    }, "share-ended"],
    ["reconexão com SID novo", () => t.gate.peerSeen(ana.identity, "PA_ana2"), "reconnected"],
  ];
  for (const [name, fire, reason] of triggers) {
    it(`${name}: solta tudo ANTES de limpar o estado`, () => {
      t.input({ t: "key", scancode: 0x2a, down: true });
      t.log.length = 0;
      fire();
      expect(t.log).toEqual(["inject:release", "session:off"]);
      expect(t.sent.at(-1)?.msg).toEqual({ t: "revoke", sessionId: SESSION, reason });
      expect(t.input({ t: "move", x: 1, y: 1 })).toBe(false);
    });
  }
  it("controlador saiu: solta tudo, sem mandar para quem já foi", () => {
    const before = t.sent.length;
    t.gate.peerGone(ana.identity, "left");
    expect(t.log.slice(-2)).toEqual(["inject:release", "session:off"]);
    expect(t.sent.length).toBe(before);
  });
  it("revoke vindo do controlador encerra", () => {
    t.gate.handleCtl(ana, { t: "revoke", sessionId: SESSION, reason: "user" });
    expect(t.gate.active).toBeNull();
  });
  it("ping vira pong só para a sessão certa", () => {
    t.gate.handleCtl(ana, { t: "ping", sessionId: SESSION, n: 3 });
    expect(t.sent.at(-1)?.msg).toEqual({ t: "pong", sessionId: SESSION, n: 3 });
    const n = t.sent.length;
    t.gate.handleCtl({ ...ana, sid: "PA_x" }, { t: "ping", sessionId: SESSION, n: 4 });
    expect(t.sent.length).toBe(n);
  });
});

describe("área de transferência", () => {
  const clip = (text: string) => clipChunks(text)!;
  beforeEach(() => t.grant());

  it("junta os pedaços e põe o texto inteiro, antes do Ctrl+V que vem depois", () => {
    const text = "linha 1\r\nolá 😀 ".repeat(200);
    for (const c of clip(text)) expect(t.input(c)).toBe(true);
    t.input({ t: "key", scancode: 0x1d, down: true });
    t.input({ t: "key", scancode: 0x2f, down: true });
    expect(t.clipboard).toEqual([text]);
    expect(t.log.slice(-3)).toEqual(["clipboard", "inject:key", "inject:key"]);
  });
  it("pedaço sem o primeiro, ou UTF-8 inválido, não muda nada", () => {
    expect(t.input({ t: "clip", flags: CLIP_LAST, bytes: new Uint8Array([0x61]) })).toBe(false);
    expect(t.input({ t: "clip", flags: CLIP_FIRST | CLIP_LAST, bytes: new Uint8Array([0xc3, 0x28]) })).toBe(false);
    expect(t.clipboard).toEqual([]);
  });
  it("um novo primeiro pedaço descarta o que estava pela metade", () => {
    const [first] = clip("a".repeat(3000));
    t.input(first);
    for (const c of clip("novo")) t.input(c);
    expect(t.clipboard).toEqual(["novo"]);
  });
  it("pausado não entra, e o que estava chegando é descartado", () => {
    const [first, ...rest] = clip("b".repeat(3000));
    t.input(first);
    t.gate.setPaused(true);
    expect(t.input(rest[0])).toBe(false);
    t.gate.setPaused(false);
    for (const c of rest) t.input(c);
    expect(t.clipboard).toEqual([]);
  });
  it("128 KiB de uma vez não estoura o balde", () => {
    for (const c of clip("c".repeat(128 * 1024))) t.input(c);
    expect(t.gate.active).not.toBeNull();
    expect(t.clipboard).toHaveLength(1);
  });
  it("só de quem controla", () => {
    for (const c of clip("x")) t.input(c, { identity: "Bia-00000000", sid: "PA_b", name: "Bia" });
    expect(t.clipboard).toEqual([]);
  });
});

describe("imagem e arquivos na área de transferência", () => {
  const CLIP = "ICEiIyQlJicoKSorLC0uLw";
  it("só aceitam de quem controla, na sessão ativa e sem pausa", () => {
    expect(t.gate.acceptsClip(ana, SESSION)).toBe(false);
    t.grant();
    expect(t.gate.acceptsClip(ana, SESSION)).toBe(true);
    expect(t.gate.acceptsClip({ ...ana, sid: "PA_outro" }, SESSION)).toBe(false);
    expect(t.gate.acceptsClip(ana, REQ)).toBe(false);
    t.gate.setPaused(true);
    expect(t.gate.acceptsClip(ana, SESSION)).toBe(false);
  });
  it("a resposta vai para quem controla, e só na mesma sessão", () => {
    t.grant();
    t.gate.clipResult(SESSION, CLIP, true);
    expect(t.sent.at(-1)).toEqual({ to: ana.identity, msg: { t: "clip", sessionId: SESSION, clipId: CLIP, ok: true } });
    const before = t.sent.length;
    t.gate.clipResult(REQ, CLIP, true);
    expect(t.sent).toHaveLength(before);
  });
});

describe("acesso direto (admin)", () => {
  const SALT = "MDEyMzQ1Njc4OUFCQ0RFRg";
  const GOOD_PROOF = "A".repeat(43);
  const BAD_PROOF = "B".repeat(43);

  function enableUnattended() {
    let lastNonce = "";
    t.world.unattended = {
      salt: SALT,
      verify: (reqId, nonce, proof) => {
        lastNonce = nonce;
        return reqId === REQ && proof === GOOD_PROOF;
      },
    };
    return () => lastNonce;
  }

  it("sem senha configurada recusa com auth-unavailable", () => {
    t.gate.handleCtl(ana, { t: "auth-request", v: 1, reqId: REQ });
    expect(t.sent.at(-1)).toEqual({ to: ana.identity, msg: { t: "deny", reqId: REQ, reason: "auth-unavailable" } });
    expect(t.consents).toEqual([]);
  });

  it("com 'Nunca aceitar pedidos de controle' ligado recusa com disabled mesmo com senha configurada", () => {
    enableUnattended();
    t.world.disabled = true;
    t.gate.handleCtl(ana, { t: "auth-request", v: 1, reqId: REQ });
    expect(t.sent.at(-1)?.msg).toEqual({ t: "deny", reqId: REQ, reason: "disabled" });
  });

  it("desafio-resposta válido concede sessão direta sem abrir diálogo de consentimento", () => {
    const getNonce = enableUnattended();
    t.gate.handleCtl(ana, { t: "auth-request", v: 1, reqId: REQ });
    expect(t.consents).toEqual([]);
    const challenge = t.sent.at(-1)?.msg;
    expect(challenge).toMatchObject({ t: "auth-challenge", reqId: REQ, salt: SALT });
    expect(t.gate.active).toBeNull();

    t.gate.handleCtl(ana, { t: "auth-response", reqId: REQ, proof: GOOD_PROOF });
    expect(getNonce()).toBe((challenge as Extract<Ctl, { t: "auth-challenge" }>).nonce);
    expect(t.sent.at(-1)?.msg).toMatchObject({ t: "grant", reqId: REQ, trackSid: "TR_screen", width: 1920, height: 1080 });
    expect(t.gate.active).toEqual({
      identity: ana.identity,
      name: ana.name,
      paused: false,
      elevated: false,
      direct: true,
    });
    expect(t.consents).toEqual([]);
  });

  it("senha errada recusa com bad-password, aplica espera progressiva e impede replay", () => {
    enableUnattended();
    t.gate.handleCtl(ana, { t: "auth-request", v: 1, reqId: REQ });
    t.gate.handleCtl(ana, { t: "auth-response", reqId: REQ, proof: BAD_PROOF });
    expect(t.sent.at(-1)?.msg).toEqual({ t: "deny", reqId: REQ, reason: "bad-password" });
    expect(t.gate.active).toBeNull();

    // Reenviar a resposta para o mesmo desafio já consumido é ignorado.
    const before = t.sent.length;
    t.gate.handleCtl(ana, { t: "auth-response", reqId: REQ, proof: GOOD_PROOF });
    expect(t.sent.length).toBe(before);
    expect(t.gate.active).toBeNull();

    // Durante a espera (1.5 s após 1ª falha), novo pedido cai em cooldown.
    t.gate.handleCtl(ana, { t: "auth-request", v: 1, reqId: SESSION });
    expect(t.sent.at(-1)?.msg).toEqual({ t: "deny", reqId: SESSION, reason: "cooldown" });

    // Depois da espera, pode tentar de novo e entrar com a prova certa.
    t.advance(1_500);
    t.gate.handleCtl(ana, { t: "auth-request", v: 1, reqId: REQ });
    expect(t.sent.at(-1)?.msg).toMatchObject({ t: "auth-challenge", reqId: REQ });
    t.gate.handleCtl(ana, { t: "auth-response", reqId: REQ, proof: GOOD_PROOF });
    expect(t.gate.active?.direct).toBe(true);
  });

  it("desafio é preso ao SID e expira em 15 s", () => {
    enableUnattended();
    t.gate.handleCtl(ana, { t: "auth-request", v: 1, reqId: REQ });
    // Outro SID não pode responder ao desafio da Ana.
    t.gate.handleCtl({ ...ana, sid: "PA_outro" }, { t: "auth-response", reqId: REQ, proof: GOOD_PROOF });
    expect(t.gate.active).toBeNull();

    t.advance(15_000);
    expect(t.sent.at(-1)?.msg).toEqual({ t: "deny", reqId: REQ, reason: "timeout" });
    t.gate.handleCtl(ana, { t: "auth-response", reqId: REQ, proof: GOOD_PROOF });
    expect(t.gate.active).toBeNull();
  });

  it("cancelar ou parar compartilhamento encerra o desafio pendente", () => {
    enableUnattended();
    t.gate.handleCtl(ana, { t: "auth-request", v: 1, reqId: REQ });
    t.gate.handleCtl(ana, { t: "cancel", reqId: REQ });
    t.gate.handleCtl(ana, { t: "auth-response", reqId: REQ, proof: GOOD_PROOF });
    expect(t.gate.active).toBeNull();

    t.gate.handleCtl(ana, { t: "auth-request", v: 1, reqId: REQ });
    t.world.share = null;
    t.gate.shareChanged();
    expect(t.sent.at(-1)?.msg).toEqual({ t: "deny", reqId: REQ, reason: "not-sharing" });
  });
});
