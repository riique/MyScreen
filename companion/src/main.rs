//! MyScreen Áudio — captura o som do PC e entrega para a aba do MyScreen.
//!
//! O Chrome no Windows falha (`NotReadableError`) ao capturar o som do sistema
//! quando a saída padrão tem mais de 2 canais (fone 7.1, por exemplo). Aqui a
//! captura usa o loopback por processo do Windows: o próprio sistema mistura
//! a saída em estéreo 48 kHz, qualquer que seja o formato do dispositivo.
//!
//! O áudio sai por um WebSocket em 127.0.0.1, só para páginas do MyScreen que
//! apresentem o código de pareamento. A captura só roda enquanto há uma página
//! conectada.

#![windows_subsystem = "windows"]

use std::collections::hash_map::RandomState;
use std::collections::VecDeque;
use std::hash::{BuildHasher, Hasher};
use std::net::{TcpListener, TcpStream};
use std::path::PathBuf;
use std::io::Write;
use std::sync::atomic::{AtomicBool, AtomicIsize, AtomicU32, AtomicU64, Ordering};
use std::sync::mpsc::{sync_channel, Receiver, RecvTimeoutError, SyncSender, TrySendError};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;

use eframe::egui;
use tungstenite::handshake::server::{ErrorResponse, Request, Response};
use tungstenite::Message;

const PORT: u16 = 47810;
const SAMPLE_RATE: usize = 48_000;
const CHANNELS: usize = 2;
/// 10 ms por mensagem: latência baixa sem afogar o WebSocket.
const FRAMES_PER_PACKET: usize = SAMPLE_RATE / 100;

const ALLOWED_ORIGINS: &[&str] = &[
    "https://myscreen.haumea.fun",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
];

type Packet = Arc<Vec<u8>>;

struct Shared {
    clients: Mutex<Vec<SyncSender<Packet>>>,
    token: Mutex<String>,
    exclude_chrome: AtomicBool,
    exclude_discord: AtomicBool,
    /// Ganho manual aplicado antes de enviar, em bits de f32 (1.0 = 100%).
    gain: AtomicU32,
    normalize: AtomicBool,
    agc: Mutex<Agc>,
    /// Ganho atual da normalização, em dB (bits de f32), para mostrar na tela.
    agc_db: AtomicU32,
    /// Muda quando a configuração de captura muda; a captura reinicia.
    generation: AtomicU64,
    /// Pico do último pacote, em bits de f32.
    level: AtomicU32,
    error: Mutex<Option<String>>,
    /// HWND da janela, para mostrar/ocultar de qualquer thread.
    hwnd: AtomicIsize,
    /// O instalador (atualização) ou o desinstalador pediu para fechar.
    quitting: AtomicBool,
    egui_ctx: Mutex<Option<egui::Context>>,
}

impl Shared {
    fn client_count(&self) -> usize {
        self.clients.lock().unwrap().len()
    }
    fn set_error(&self, e: Option<String>) {
        *self.error.lock().unwrap() = e;
    }
}

// ---------------------------------------------------------------- token

fn token_path() -> PathBuf {
    let base = std::env::var_os("APPDATA").map(PathBuf::from).unwrap_or_else(std::env::temp_dir);
    base.join("MyScreenAudio").join("token.txt")
}

fn new_token() -> String {
    // Sem ambíguos (0/O, 1/I/L): o código é lido e digitado por gente.
    const ALPHABET: &[u8] = b"ABCDEFGHJKMNPQRSTUVWXYZ23456789";
    let mut out = String::new();
    for i in 0..8 {
        let mut h = RandomState::new().build_hasher();
        h.write_usize(i);
        h.write_u128(std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos());
        out.push(ALPHABET[(h.finish() % ALPHABET.len() as u64) as usize] as char);
    }
    out
}

fn load_or_create_token() -> String {
    let path = token_path();
    if let Ok(t) = std::fs::read_to_string(&path) {
        let t = t.trim().to_string();
        if t.len() == 8 {
            return t;
        }
    }
    let t = new_token();
    save_token(&t);
    t
}

fn save_token(t: &str) {
    let path = token_path();
    if let Some(dir) = path.parent() {
        let _ = std::fs::create_dir_all(dir);
    }
    let _ = std::fs::write(path, t);
}

fn prefs_path() -> PathBuf {
    token_path().with_file_name("prefs.txt")
}

struct Prefs {
    exclude_chrome: bool,
    exclude_discord: bool,
    normalize: bool,
    /// Ajuste manual depois da normalização, em %.
    gain_pct: f32,
}

/// Padrão: ignora o Chrome, normaliza, ajuste manual 100%. A chave `gain2`
/// substitui a antiga `gain` (400% fixo), que com a normalização estouraria.
fn load_prefs() -> Prefs {
    let raw = std::fs::read_to_string(prefs_path()).unwrap_or_default();
    let get = |k: &str, default: bool| {
        raw.lines()
            .find_map(|l| l.strip_prefix(k).and_then(|v| v.strip_prefix('=')))
            .map(|v| v.trim() == "1")
            .unwrap_or(default)
    };
    let gain_pct = raw
        .lines()
        .find_map(|l| l.strip_prefix("gain2="))
        .and_then(|v| v.trim().parse::<f32>().ok())
        .filter(|g| (GAIN_MIN..=GAIN_MAX).contains(g))
        .unwrap_or(100.0);
    Prefs {
        exclude_chrome: get("chrome", true),
        exclude_discord: get("discord", false),
        normalize: get("normalize", true),
        gain_pct,
    }
}

fn save_prefs(p: &Prefs) {
    let _ = std::fs::write(
        prefs_path(),
        format!(
            "chrome={}\ndiscord={}\nnormalize={}\ngain2={}\n",
            p.exclude_chrome as u8, p.exclude_discord as u8, p.normalize as u8, p.gain_pct
        ),
    );
}

const GAIN_MIN: f32 = 50.0;
const GAIN_MAX: f32 = 800.0;

fn normalize_code(s: &str) -> String {
    s.chars().filter(|c| c.is_ascii_alphanumeric()).map(|c| c.to_ascii_uppercase()).collect()
}

// ---------------------------------------------------------------- servidor

fn query_param(query: &str, key: &str) -> Option<String> {
    query.split('&').find_map(|kv| {
        let (k, v) = kv.split_once('=')?;
        (k == key).then(|| v.to_string())
    })
}

fn reject(status: u16, msg: &str) -> ErrorResponse {
    let mut res = ErrorResponse::new(Some(msg.to_string()));
    *res.status_mut() = tungstenite::http::StatusCode::from_u16(status).unwrap();
    res
}

fn handle_client(stream: TcpStream, shared: Arc<Shared>) {
    // Uma segunda cópia do app aberta pede para esta mostrar a janela.
    let mut head = [0u8; 4];
    if matches!(stream.peek(&mut head), Ok(4)) {
        if &head == b"SHOW" {
            window::show(&shared);
            return;
        }
        // O instalador fecha o app antes de trocar o exe. A interface tira o
        // ícone da bandeja e sai; se ela estiver parada (janela escondida),
        // sai mesmo assim depois de um instante.
        if &head == b"QUIT" {
            shared.quitting.store(true, Ordering::SeqCst);
            if let Some(ctx) = shared.egui_ctx.lock().unwrap().as_ref() {
                ctx.request_repaint();
            }
            thread::sleep(Duration::from_millis(1500));
            std::process::exit(0);
        }
    }
    let check = |req: &Request, res: Response| -> Result<Response, ErrorResponse> {
        let origin = req.headers().get("origin").and_then(|v| v.to_str().ok()).unwrap_or("");
        if !ALLOWED_ORIGINS.contains(&origin) {
            return Err(reject(403, "origem nao permitida"));
        }
        let code = req.uri().query().and_then(|q| query_param(q, "code")).unwrap_or_default();
        let token = shared.token.lock().unwrap().clone();
        if normalize_code(&code) != token {
            return Err(reject(401, "codigo invalido"));
        }
        Ok(res)
    };
    let mut ws = match tungstenite::accept_hdr(stream, check) {
        Ok(ws) => ws,
        Err(_) => return,
    };

    let (tx, rx): (SyncSender<Packet>, Receiver<Packet>) = sync_channel(64);
    shared.clients.lock().unwrap().push(tx);

    loop {
        match rx.recv_timeout(Duration::from_secs(2)) {
            Ok(packet) => {
                if ws.send(Message::Binary(packet.as_ref().clone().into())).is_err() {
                    break;
                }
            }
            // Sem som tocando, nada chega; o ping descobre se a aba fechou.
            Err(RecvTimeoutError::Timeout) => {
                if ws.send(Message::Ping(Vec::new().into())).is_err() {
                    break;
                }
            }
            Err(RecvTimeoutError::Disconnected) => break,
        }
    }
    // Soltar `rx` faz o próximo envio da captura falhar e o cliente sair da lista.
}

fn run_server(listener: TcpListener, shared: Arc<Shared>) {
    for stream in listener.incoming().flatten() {
        let _ = stream.set_nodelay(true);
        let s = shared.clone();
        thread::spawn(move || handle_client(stream, s));
    }
}

// ---------------------------------------------------------------- captura

const CHROME: &[&str] = &["chrome.exe"];
const DISCORD: &[&str] = &["discord.exe", "discordptb.exe", "discordcanary.exe", "discordsystemhelper.exe"];

/// Programas cujo som fica de fora: o Chrome tem o som da própria chamada (que
/// voltaria como eco para os outros), o Discord tem a voz de quem está lá.
fn excluded_names(shared: &Shared) -> Vec<&'static str> {
    let mut v = Vec::new();
    if shared.exclude_chrome.load(Ordering::SeqCst) {
        v.extend_from_slice(CHROME);
    }
    if shared.exclude_discord.load(Ordering::SeqCst) {
        v.extend_from_slice(DISCORD);
    }
    v
}

fn process_table() -> sysinfo::System {
    use sysinfo::{ProcessRefreshKind, RefreshKind, System};
    System::new_with_specifics(RefreshKind::nothing().with_processes(ProcessRefreshKind::nothing()))
}

fn exe_name(sys: &sysinfo::System, pid: sysinfo::Pid) -> Option<String> {
    sys.process(pid).map(|p| p.name().to_string_lossy().to_lowercase())
}

/// Sobe a árvore enquanto o pai tem o mesmo executável: o Chrome e o Discord
/// tocam som num processo filho, mas o loopback por processo pega a árvore
/// inteira a partir da raiz.
fn root_pid(sys: &sysinfo::System, pid: u32) -> u32 {
    let mut cur = sysinfo::Pid::from_u32(pid);
    let name = exe_name(sys, cur);
    while let Some(parent) = sys.process(cur).and_then(|p| p.parent()) {
        if exe_name(sys, parent) != name || name.is_none() {
            break;
        }
        cur = parent;
    }
    cur.as_u32()
}

/// Raízes de todos os processos com um dos nomes dados.
fn roots_named(sys: &sysinfo::System, names: &[&str]) -> Vec<u32> {
    let mut roots: Vec<u32> = sys
        .processes()
        .iter()
        .filter(|(_, p)| names.contains(&p.name().to_string_lossy().to_lowercase().as_str()))
        .map(|(pid, _)| root_pid(sys, pid.as_u32()))
        .collect();
    roots.sort_unstable();
    roots.dedup();
    roots
}

fn broadcast(shared: &Shared, packet: Packet) {
    shared.clients.lock().unwrap().retain(|tx| match tx.try_send(packet.clone()) {
        Ok(()) => true,
        // Aba lenta: perde 10 ms de som em vez de acumular atraso.
        Err(TrySendError::Full(_)) => true,
        Err(TrySendError::Disconnected(_)) => false,
    });
}

/// Converte f32 -> i16 intercalado, atualiza o medidor e envia.
fn emit(shared: &Shared, samples: &[f32], peak_acc: &mut f32) {
    let gain = f32::from_bits(shared.gain.load(Ordering::Relaxed));
    let mut block = samples.to_vec();
    if shared.normalize.load(Ordering::Relaxed) {
        let mut agc = shared.agc.lock().unwrap();
        agc.process(&mut block);
        shared.agc_db.store(agc.gain_db.to_bits(), Ordering::Relaxed);
    }
    let mut out = Vec::with_capacity(block.len() * 2);
    for &v in &block {
        let v = soft_limit(v * gain);
        *peak_acc = peak_acc.max(v.abs());
        out.extend_from_slice(&((v * 32767.0) as i16).to_le_bytes());
    }
    broadcast(shared, Arc::new(out));
}

/// Normalização automática de volume.
///
/// Mede a intensidade (RMS) numa janela de ~300 ms e ajusta o ganho para levar
/// o som a -16 dBFS RMS — nível de plataforma de streaming. Desce rápido
/// (80 ms, para uma explosão não estourar) e sobe devagar (1,5 s, para não
/// "respirar" entre uma frase e outra). Em silêncio segura o ganho: não sobe o
/// chiado de fundo até virar ruído.
struct Agc {
    env: f32,
    gain_db: f32,
}

impl Agc {
    const TARGET_DB: f32 = -16.0;
    const MIN_DB: f32 = -6.0;
    const MAX_DB: f32 = 24.0;
    const SILENCE: f32 = 1e-6; // -60 dBFS de energia média

    fn new() -> Self {
        Self { env: 0.0, gain_db: 0.0 }
    }

    fn process(&mut self, block: &mut [f32]) {
        if block.is_empty() {
            return;
        }
        let block_ms = (block.len() / CHANNELS) as f32 * 1000.0 / SAMPLE_RATE as f32;
        let ms = block.iter().map(|v| v * v).sum::<f32>() / block.len() as f32;
        let a = (-block_ms / 300.0).exp();
        self.env = self.env * a + ms * (1.0 - a);

        let old = self.gain_db;
        if self.env > Self::SILENCE {
            let loud_db = 10.0 * self.env.log10();
            let want = (Self::TARGET_DB - loud_db).clamp(Self::MIN_DB, Self::MAX_DB);
            let tau = if want < old { 80.0 } else { 1500.0 };
            let c = (-block_ms / tau).exp();
            self.gain_db = old * c + want * (1.0 - c);
        }

        // Interpola o ganho dentro do bloco: sem degrau a cada 10 ms (zíper).
        let (g0, g1) = (db_to_lin(old), db_to_lin(self.gain_db));
        let frames = block.len() / CHANNELS;
        for (i, frame) in block.chunks_exact_mut(CHANNELS).enumerate() {
            let g = g0 + (g1 - g0) * (i as f32 + 1.0) / frames as f32;
            for v in frame {
                *v *= g;
            }
        }
    }
}

fn db_to_lin(db: f32) -> f32 {
    10f32.powf(db / 20.0)
}

/// Limitador suave: abaixo de 0.8 passa intacto; acima, curva até no máximo
/// 1.0. Deixa subir o volume sem o estalo de corte nos picos (explosões, bumbo).
fn soft_limit(x: f32) -> f32 {
    const KNEE: f32 = 0.8;
    let a = x.abs();
    if a <= KNEE {
        x
    } else {
        x.signum() * (KNEE + (1.0 - KNEE) * ((a - KNEE) / (1.0 - KNEE)).tanh())
    }
}

fn update_level(shared: &Shared, peak: f32) {
    let prev = f32::from_bits(shared.level.load(Ordering::Relaxed));
    shared.level.store(peak.max(prev * 0.85).to_bits(), Ordering::Relaxed);
}

/// Uma captura de loopback por processo, já em estéreo 48 kHz f32.
struct Loopback {
    client: wasapi::AudioClient,
    capture: wasapi::AudioCaptureClient,
    event: wasapi::Handle,
    /// Canais pedidos ao Windows (os do dispositivo de saída).
    channels: usize,
    /// O que chegou do Windows, ainda em `channels` canais.
    raw: VecDeque<u8>,
    /// Já em estéreo f32: é daqui que o resto do app lê.
    bytes: VecDeque<u8>,
}

/// Canais do formato de mixagem da saída padrão (8 num fone 7.1).
fn device_channels() -> usize {
    wasapi::DeviceEnumerator::new()
        .and_then(|e| e.get_default_device(&wasapi::Direction::Render))
        .and_then(|d| d.get_iaudioclient())
        .and_then(|c| c.get_mixformat())
        .map(|f| f.get_nchannels() as usize)
        .unwrap_or(CHANNELS)
        .clamp(1, 8)
}

/// Mistura um quadro de N canais para estéreo, sem perder volume.
///
/// Pedir estéreo direto ao Windows numa saída 7.1 custa ~14 dB: a conversão
/// dele divide o sinal entre os 8 canais para nunca estourar (medido aqui: tom
/// de -12 dBFS chegava a -25 dBFS). Música e jogo estéreo vivem em FL/FR, então
/// eles passam inteiros; centro e laterais entram a -3 dB, LFE fica de fora. O
/// limitador no envio segura o que somar acima de 0 dBFS.
/// Ordem WAVE: FL FR FC LFE BL BR SL SR.
fn downmix(f: &[f32]) -> (f32, f32) {
    const H: f32 = std::f32::consts::FRAC_1_SQRT_2;
    match f.len() {
        1 => (f[0], f[0]),
        2 | 3 | 4 => (f[0], f[1]),
        6 => (f[0] + H * (f[2] + f[4]), f[1] + H * (f[2] + f[5])),
        8 => (
            f[0] + H * (f[2] + f[4] + f[6]),
            f[1] + H * (f[2] + f[5] + f[7]),
        ),
        _ => (f[0], f[1]),
    }
}

impl Loopback {
    fn open(pid: u32, include_tree: bool) -> Result<Self, String> {
        use wasapi::*;
        // Sem máscara de canais: com a máscara 7.1 o loopback por processo
        // entrega só silêncio; sem ela, os 8 canais chegam no nível certo.
        let channels = device_channels();
        let format = WaveFormat::new(32, 32, &SampleType::Float, SAMPLE_RATE, channels, None);
        let mut client = AudioClient::new_application_loopback_client(pid, include_tree)
            .map_err(|e| format!("loopback: {e}"))?;
        let mode = StreamMode::EventsShared { autoconvert: true, buffer_duration_hns: 0 };
        client
            .initialize_client(&format, &Direction::Capture, &mode)
            .map_err(|e| format!("initialize: {e}"))?;
        let event = client.set_get_eventhandle().map_err(|e| format!("event: {e}"))?;
        let capture = client.get_audiocaptureclient().map_err(|e| format!("capture: {e}"))?;
        client.start_stream().map_err(|e| format!("start: {e}"))?;
        Ok(Self { client, capture, event, channels, raw: VecDeque::new(), bytes: VecDeque::new() })
    }

    /// Lê o que o Windows tiver; sem som tocando não chega nada (é normal).
    fn pull(&mut self) -> Result<(), String> {
        while self.capture.get_next_packet_size().ok().flatten().unwrap_or(0) > 0 {
            self.capture
                .read_from_device_to_deque(&mut self.raw)
                .map_err(|e| format!("read: {e}"))?;
        }
        let frame_bytes = self.channels * 4;
        let mut frame = [0f32; 8];
        while self.raw.len() >= frame_bytes {
            for v in frame.iter_mut().take(self.channels) {
                let b = [
                    self.raw.pop_front().unwrap(),
                    self.raw.pop_front().unwrap(),
                    self.raw.pop_front().unwrap(),
                    self.raw.pop_front().unwrap(),
                ];
                *v = f32::from_le_bytes(b);
            }
            let (l, r) = downmix(&frame[..self.channels]);
            self.bytes.extend(l.to_le_bytes());
            self.bytes.extend(r.to_le_bytes());
        }
        Ok(())
    }

    fn frames(&self) -> usize {
        self.bytes.len() / (4 * CHANNELS)
    }

    /// Soma `n` quadros em `mix` (faltando, completa com silêncio).
    fn mix_into(&mut self, mix: &mut [f32], n: usize) {
        let take = n.min(self.frames()) * CHANNELS;
        for slot in mix.iter_mut().take(take) {
            let b = [
                self.bytes.pop_front().unwrap(),
                self.bytes.pop_front().unwrap(),
                self.bytes.pop_front().unwrap(),
                self.bytes.pop_front().unwrap(),
            ];
            *slot += f32::from_le_bytes(b);
        }
    }
}

impl Drop for Loopback {
    fn drop(&mut self) {
        let _ = self.client.stop_stream();
    }
}

fn keep_going(shared: &Shared, generation: u64) -> bool {
    shared.client_count() > 0 && shared.generation.load(Ordering::SeqCst) == generation
}

/// Caso comum: no máximo um programa ignorado. Uma captura só, do sistema
/// inteiro menos a árvore desse programa — sem mixagem e sem atraso extra.
fn capture_single(shared: &Shared, generation: u64, exclude: Option<u32>) -> Result<(), String> {
    // Excluir só a si mesmo = capturar o sistema inteiro.
    let mut lb = Loopback::open(exclude.unwrap_or_else(std::process::id), false)?;
    shared.set_error(None);
    let mut buf = vec![0f32; FRAMES_PER_PACKET * CHANNELS];
    while keep_going(shared, generation) {
        let _ = lb.event.wait_for_event(100);
        lb.pull()?;
        let mut peak = 0f32;
        while lb.frames() >= FRAMES_PER_PACKET {
            buf.fill(0.0);
            lb.mix_into(&mut buf, FRAMES_PER_PACKET);
            emit(shared, &buf, &mut peak);
        }
        update_level(shared, peak);
    }
    Ok(())
}

/// Uma fonte da mistura: a captura de um programa roda na própria thread, porque
/// abrir o loopback de alguns apps leva segundos (o WhatsApp levou 4,7 s) e não
/// pode congelar as outras fontes. A thread só empurra amostras para a fila.
struct MixSource {
    queue: Arc<Mutex<VecDeque<f32>>>,
    stop: Arc<AtomicBool>,
    failed: Arc<AtomicBool>,
    primed: bool,
}

impl MixSource {
    fn spawn(pid: u32, max_samples: usize) -> Self {
        let queue = Arc::new(Mutex::new(VecDeque::new()));
        let stop = Arc::new(AtomicBool::new(false));
        let failed = Arc::new(AtomicBool::new(false));
        let (q, st, f) = (queue.clone(), stop.clone(), failed.clone());
        thread::spawn(move || {
            let _ = wasapi::initialize_mta();
            let mut lb = match Loopback::open(pid, true) {
                Ok(lb) => lb,
                Err(_) => {
                    f.store(true, Ordering::SeqCst);
                    return;
                }
            };
            while !st.load(Ordering::SeqCst) {
                let _ = lb.event.wait_for_event(100);
                if lb.pull().is_err() {
                    f.store(true, Ordering::SeqCst);
                    return;
                }
                let n = lb.bytes.len() / 4;
                if n == 0 {
                    continue;
                }
                let mut q = q.lock().unwrap();
                for _ in 0..n {
                    let b = [
                        lb.bytes.pop_front().unwrap(),
                        lb.bytes.pop_front().unwrap(),
                        lb.bytes.pop_front().unwrap(),
                        lb.bytes.pop_front().unwrap(),
                    ];
                    q.push_back(f32::from_le_bytes(b));
                }
                // Fila longa demais = esta fonte adiantou; corta o excesso para o
                // atraso não crescer.
                if q.len() > max_samples {
                    let extra = q.len() - max_samples / 5;
                    q.drain(..extra);
                }
            }
        });
        Self { queue, stop, failed, primed: false }
    }
}

impl Drop for MixSource {
    fn drop(&mut self) {
        self.stop.store(true, Ordering::SeqCst);
    }
}

/// Dois ou mais programas ignorados: o Windows só sabe excluir UMA árvore por
/// captura. Então o caminho se inverte: uma captura por programa que tem
/// sessão de som (menos os ignorados), misturadas aqui num relógio de 10 ms.
fn capture_mixed(shared: &Shared, generation: u64, excluded_roots: &[u32]) -> Result<(), String> {
    use std::collections::HashMap;
    use std::time::Instant;

    const PACKET: usize = FRAMES_PER_PACKET * CHANNELS;
    // 20 ms de folga por fonte antes de entrar na mistura: absorve o jitter
    // entre o relógio do Windows e o desta thread.
    const PRIME: usize = PACKET * 2;
    const MAX_QUEUE: usize = PACKET * 10;

    let mut sources: HashMap<u32, MixSource> = HashMap::new();
    let mut failed: HashMap<u32, Instant> = HashMap::new();
    let mut last_scan = Instant::now() - Duration::from_secs(10);
    let mut next_emit = Instant::now();
    let mut buf = vec![0f32; PACKET];
    let me = std::process::id();
    shared.set_error(None);

    while keep_going(shared, generation) {
        // A cada segundo: quem tem sessão de som agora? Um jogo aberto depois
        // entra na mistura em até 1 s.
        if last_scan.elapsed() >= Duration::from_secs(1) {
            last_scan = Instant::now();
            let sys = process_table();
            let mut wanted: Vec<u32> = Vec::new();
            if let Ok(dev) = wasapi::DeviceEnumerator::new()
                .and_then(|e| e.get_default_device(&wasapi::Direction::Render))
            {
                if let Ok(sessions) = dev.get_iaudiosessionmanager().and_then(|m| m.get_audiosessionenumerator()) {
                    for i in 0..sessions.get_count().unwrap_or(0) {
                        let Ok(pid) = sessions.get_session(i).and_then(|c| c.get_process_id()) else { continue };
                        if pid == 0 || pid == me {
                            continue;
                        }
                        let root = root_pid(&sys, pid);
                        if !excluded_roots.contains(&root) && !wanted.contains(&root) {
                            wanted.push(root);
                        }
                    }
                }
            }
            sources.retain(|pid, src| {
                let dead = src.failed.load(Ordering::SeqCst);
                if dead {
                    failed.insert(*pid, Instant::now());
                }
                !dead && wanted.contains(pid)
            });
            for pid in wanted {
                let recently_failed = failed.get(&pid).is_some_and(|t| t.elapsed() < Duration::from_secs(10));
                if !sources.contains_key(&pid) && !recently_failed {
                    sources.insert(pid, MixSource::spawn(pid, MAX_QUEUE));
                }
            }
        }

        let mut peak = 0f32;
        let now = Instant::now();
        if now.duration_since(next_emit) > Duration::from_millis(100) {
            next_emit = now; // a thread ficou parada; não tenta recuperar o atraso
        }
        while now >= next_emit {
            buf.fill(0.0);
            for src in sources.values_mut() {
                let mut q = src.queue.lock().unwrap();
                if !src.primed && q.len() >= PRIME {
                    src.primed = true;
                }
                if src.primed {
                    let take = PACKET.min(q.len());
                    if take < PACKET {
                        src.primed = false; // acabou o som: volta a esperar folga
                    }
                    for (slot, v) in buf.iter_mut().zip(q.drain(..take)) {
                        *slot += v;
                    }
                }
            }
            emit(shared, &buf, &mut peak);
            next_emit += Duration::from_millis(10);
        }
        update_level(shared, peak);
        thread::sleep(Duration::from_millis(3));
    }
    Ok(())
}

fn capture_session(shared: &Shared) -> Result<(), String> {
    let generation = shared.generation.load(Ordering::SeqCst);
    let names = excluded_names(shared);
    let roots = if names.is_empty() { Vec::new() } else { roots_named(&process_table(), &names) };
    match roots.as_slice() {
        [] => capture_single(shared, generation, None),
        [one] => capture_single(shared, generation, Some(*one)),
        many => capture_mixed(shared, generation, many),
    }
}

fn run_capture(shared: Arc<Shared>) {
    let _ = wasapi::initialize_mta();
    loop {
        if shared.client_count() == 0 {
            shared.level.store(0f32.to_bits(), Ordering::Relaxed);
            thread::sleep(Duration::from_millis(150));
            continue;
        }
        if let Err(e) = capture_session(&shared) {
            shared.set_error(Some(format!("Falha na captura de áudio: {e}")));
            thread::sleep(Duration::from_secs(2));
        }
    }
}

// ---------------------------------------------------------------- interface

const BG: egui::Color32 = egui::Color32::from_rgb(0x10, 0x11, 0x14);
const PANEL: egui::Color32 = egui::Color32::from_rgb(0x18, 0x19, 0x1d);
const RULE: egui::Color32 = egui::Color32::from_rgb(0x2a, 0x2c, 0x32);
const INK: egui::Color32 = egui::Color32::from_rgb(0xec, 0xec, 0xe8);
const INK_3: egui::Color32 = egui::Color32::from_rgb(0x8e, 0x92, 0x99);
const SIGNAL: egui::Color32 = egui::Color32::from_rgb(0x7f, 0x9c, 0xe0);
const LIVE: egui::Color32 = egui::Color32::from_rgb(0x4c, 0xc3, 0x8a);
const ALERT: egui::Color32 = egui::Color32::from_rgb(0xe0, 0x7a, 0x66);

// ---------------------------------------------------------------- janela, bandeja, inicialização

mod window {
    use super::Shared;
    use std::sync::atomic::Ordering;
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        SetForegroundWindow, ShowWindow, ShowWindowAsync, SW_HIDE, SW_RESTORE, SW_SHOW,
    };

    pub fn show(shared: &Shared) {
        let hwnd = shared.hwnd.load(Ordering::SeqCst);
        if hwnd == 0 {
            return;
        }
        unsafe {
            ShowWindowAsync(hwnd as _, SW_SHOW);
            ShowWindowAsync(hwnd as _, SW_RESTORE);
            SetForegroundWindow(hwnd as _);
        }
    }

    pub fn hide(shared: &Shared) {
        let hwnd = shared.hwnd.load(Ordering::SeqCst);
        if hwnd != 0 {
            unsafe { ShowWindow(hwnd as _, SW_HIDE) };
        }
    }
}

mod autostart {
    use winreg::enums::{HKEY_CURRENT_USER, KEY_READ, KEY_WRITE};
    use winreg::RegKey;

    const RUN: &str = r"Software\Microsoft\Windows\CurrentVersion\Run";
    const NAME: &str = "MyScreenAudio";

    fn command() -> Option<String> {
        let exe = std::env::current_exe().ok()?;
        Some(format!("\"{}\" --hidden", exe.display()))
    }

    pub fn is_enabled() -> bool {
        let key = RegKey::predef(HKEY_CURRENT_USER).open_subkey_with_flags(RUN, KEY_READ);
        let value: Option<String> = key.ok().and_then(|k| k.get_value(NAME).ok());
        value.is_some() && value == command()
    }

    pub fn set(enabled: bool) -> std::io::Result<()> {
        let key = RegKey::predef(HKEY_CURRENT_USER).open_subkey_with_flags(RUN, KEY_READ | KEY_WRITE)?;
        if enabled {
            key.set_value(NAME, &command().unwrap_or_default())
        } else {
            match key.delete_value(NAME) {
                Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
                r => r,
            }
        }
    }
}

/// Ícone desenhado em código: quadrado azul do MyScreen com barras de som.
fn icon_rgba(size: u32) -> Vec<u8> {
    let mut px = vec![0u8; (size * size * 4) as usize];
    let s = size as f32;
    let bars = [0.35f32, 0.7, 1.0, 0.55];
    let bw = s * 0.12;
    let gap = s * 0.06;
    let x0 = (s - (bars.len() as f32 * bw + (bars.len() - 1) as f32 * gap)) / 2.0;
    let r = s * 0.2;
    for y in 0..size {
        for x in 0..size {
            let (fx, fy) = (x as f32 + 0.5, y as f32 + 0.5);
            // Cantos arredondados.
            let cx = fx.clamp(r, s - r);
            let cy = fy.clamp(r, s - r);
            if (fx - cx).powi(2) + (fy - cy).powi(2) > r * r {
                continue;
            }
            let mut c = [0x1b, 0x3a, 0x7d, 0xff];
            for (i, h) in bars.iter().enumerate() {
                let bx = x0 + i as f32 * (bw + gap);
                let bh = s * 0.6 * h;
                if fx >= bx && fx < bx + bw && (fy - s / 2.0).abs() < bh / 2.0 {
                    c = [0xff, 0xff, 0xff, 0xff];
                }
            }
            let k = ((y * size + x) * 4) as usize;
            px[k..k + 4].copy_from_slice(&c);
        }
    }
    px
}

thread_local! {
    static TRAY: std::cell::RefCell<Option<tray_icon::TrayIcon>> = const { std::cell::RefCell::new(None) };
}

fn create_tray(shared: Arc<Shared>) {
    use tray_icon::menu::{Menu, MenuEvent, MenuItem, PredefinedMenuItem};
    use tray_icon::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};

    let menu = Menu::new();
    let open = MenuItem::with_id("open", "Abrir", true, None);
    let quit = MenuItem::with_id("quit", "Sair", true, None);
    let _ = menu.append(&open);
    let _ = menu.append(&PredefinedMenuItem::separator());
    let _ = menu.append(&quit);

    let mut builder = TrayIconBuilder::new()
        .with_tooltip("MyScreen Áudio")
        .with_menu(Box::new(menu))
        .with_menu_on_left_click(false);
    if let Ok(icon) = tray_icon::Icon::from_rgba(icon_rgba(32), 32, 32) {
        builder = builder.with_icon(icon);
    }
    let tray = builder.build().ok();
    TRAY.with(|t| *t.borrow_mut() = tray);

    let s = shared.clone();
    TrayIconEvent::set_event_handler(Some(move |e: TrayIconEvent| {
        let left_up = matches!(
            e,
            TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. }
        );
        if left_up || matches!(e, TrayIconEvent::DoubleClick { .. }) {
            window::show(&s);
        }
    }));
    MenuEvent::set_event_handler(Some(move |e: MenuEvent| match e.id().0.as_str() {
        "open" => window::show(&shared),
        "quit" => {
            // Tira o ícone antes de sair para não deixar um fantasma na bandeja.
            TRAY.with(|t| t.borrow_mut().take());
            std::process::exit(0);
        }
        _ => {}
    }));
}

struct App {
    shared: Arc<Shared>,
    exclude_chrome: bool,
    exclude_discord: bool,
    normalize: bool,
    gain_pct: f32,
    autostart: bool,
    autostart_error: Option<String>,
    copied_at: Option<std::time::Instant>,
}

fn label(ui: &mut egui::Ui, text: &str) {
    ui.label(egui::RichText::new(text.to_uppercase()).monospace().size(10.5).color(INK_3));
}

impl App {
    fn save_settings(&self) {
        save_prefs(&Prefs {
            exclude_chrome: self.exclude_chrome,
            exclude_discord: self.exclude_discord,
            normalize: self.normalize,
            gain_pct: self.gain_pct,
        });
    }
}

impl eframe::App for App {
    fn ui(&mut self, root: &mut egui::Ui, _frame: &mut eframe::Frame) {
        let ctx = root.ctx().clone();
        let ctx = &ctx;
        if self.shared.quitting.load(Ordering::SeqCst) {
            TRAY.with(|t| t.borrow_mut().take());
            std::process::exit(0);
        }
        ctx.request_repaint_after(Duration::from_millis(50));
        let clients = self.shared.client_count();
        let level = f32::from_bits(self.shared.level.load(Ordering::Relaxed));
        let error = self.shared.error.lock().unwrap().clone();

        // Fechar a janela só a esconde: o app segue na bandeja.
        if ctx.input(|i| i.viewport().close_requested()) {
            ctx.send_viewport_cmd(egui::ViewportCommand::CancelClose);
            window::hide(&self.shared);
        }

        egui::CentralPanel::default()
            .frame(egui::Frame::new().fill(BG).inner_margin(egui::Margin::same(20)))
            .show(root, |ui| {
                ui.spacing_mut().item_spacing.y = 6.0;
                ui.label(egui::RichText::new("MyScreen Áudio").size(20.0).strong().color(INK));
                ui.label(
                    egui::RichText::new("Leva o som do seu PC para o compartilhamento de tela.")
                        .size(13.0)
                        .color(INK_3),
                );
                ui.add_space(14.0);

                // Status + medidor
                egui::Frame::new()
                    .fill(PANEL)
                    .stroke(egui::Stroke::new(1.0, RULE))
                    .corner_radius(egui::CornerRadius::same(3))
                    .inner_margin(egui::Margin::same(14))
                    .show(ui, |ui| {
                        ui.set_width(ui.available_width());
                        let (dot, text) = match (&error, clients) {
                            (Some(_), _) => (ALERT, "Erro".to_string()),
                            (None, 0) => (INK_3, "Aguardando o MyScreen".to_string()),
                            (None, 1) => (LIVE, "Transmitindo para 1 aba".to_string()),
                            (None, n) => (LIVE, format!("Transmitindo para {n} abas")),
                        };
                        ui.horizontal(|ui| {
                            let (r, _) = ui.allocate_exact_size(egui::vec2(10.0, 16.0), egui::Sense::hover());
                            ui.painter().circle_filled(r.center(), 4.5, dot);
                            ui.label(egui::RichText::new(text).size(14.0).strong().color(INK));
                        });
                        if let Some(e) = &error {
                            ui.label(egui::RichText::new(e).size(12.0).color(ALERT));
                        }
                        ui.add_space(6.0);
                        let (rect, _) =
                            ui.allocate_exact_size(egui::vec2(ui.available_width(), 6.0), egui::Sense::hover());
                        let p = ui.painter();
                        p.rect_filled(rect, egui::CornerRadius::same(2), RULE);
                        let mut fill = rect;
                        fill.set_width(rect.width() * level.clamp(0.0, 1.0).sqrt());
                        p.rect_filled(fill, egui::CornerRadius::same(2), if clients > 0 { LIVE } else { INK_3 });
                    });

                ui.add_space(10.0);
                ui.horizontal(|ui| {
                    let before = self.normalize;
                    ui.checkbox(
                        &mut self.normalize,
                        egui::RichText::new("Normalizar volume (recomendado)").size(13.0).color(INK),
                    );
                    if before != self.normalize {
                        self.shared.normalize.store(self.normalize, Ordering::Relaxed);
                        self.save_settings();
                    }
                    if self.normalize && clients > 0 {
                        let db = f32::from_bits(self.shared.agc_db.load(Ordering::Relaxed));
                        ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                            ui.label(
                                egui::RichText::new(format!("{db:+.0} dB"))
                                    .monospace()
                                    .size(11.0)
                                    .color(INK_3),
                            );
                        });
                    }
                });
                ui.horizontal(|ui| {
                    label(ui, "Volume enviado");
                    ui.spacing_mut().slider_width = 200.0;
                    let r = ui.add(
                        egui::Slider::new(&mut self.gain_pct, GAIN_MIN..=GAIN_MAX)
                            .step_by(25.0)
                            .suffix("%"),
                    );
                    if r.changed() {
                        self.shared.gain.store((self.gain_pct / 100.0).to_bits(), Ordering::Relaxed);
                    }
                    if r.drag_stopped() || (r.changed() && !r.dragged()) {
                        self.save_settings();
                    }
                });

                ui.add_space(14.0);
                label(ui, "Código de pareamento");
                let token = self.shared.token.lock().unwrap().clone();
                ui.horizontal(|ui| {
                    ui.label(
                        egui::RichText::new(format!("{}-{}", &token[..4], &token[4..]))
                            .monospace()
                            .size(26.0)
                            .strong()
                            .color(INK),
                    );
                    ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                        let copied = self.copied_at.is_some_and(|t| t.elapsed() < Duration::from_secs(2));
                        let btn = egui::Button::new(
                            egui::RichText::new(if copied { "Copiado" } else { "Copiar" })
                                .size(13.0)
                                .color(egui::Color32::WHITE),
                        )
                        .fill(egui::Color32::from_rgb(0x1b, 0x3a, 0x7d))
                        .corner_radius(egui::CornerRadius::same(3))
                        .min_size(egui::vec2(78.0, 30.0));
                        if ui.add(btn).clicked() {
                            ctx.copy_text(token.clone());
                            self.copied_at = Some(std::time::Instant::now());
                        }
                    });
                });
                ui.label(
                    egui::RichText::new("Cole no MyScreen: Compartilhar tela > Som do PC > App.")
                        .size(12.0)
                        .color(INK_3),
                );

                ui.add_space(14.0);
                let before = (self.exclude_chrome, self.exclude_discord);
                ui.checkbox(
                    &mut self.exclude_chrome,
                    egui::RichText::new("Ignorar o som do Chrome (evita eco da chamada)").size(13.0).color(INK),
                );
                ui.checkbox(
                    &mut self.exclude_discord,
                    egui::RichText::new("Ignorar o som do Discord").size(13.0).color(INK),
                );
                if before != (self.exclude_chrome, self.exclude_discord) {
                    self.shared.exclude_chrome.store(self.exclude_chrome, Ordering::SeqCst);
                    self.shared.exclude_discord.store(self.exclude_discord, Ordering::SeqCst);
                    self.shared.generation.fetch_add(1, Ordering::SeqCst);
                    self.save_settings();
                }
                let before = self.autostart;
                ui.checkbox(
                    &mut self.autostart,
                    egui::RichText::new("Iniciar com o Windows (fica na bandeja)").size(13.0).color(INK),
                );
                if before != self.autostart {
                    match autostart::set(self.autostart) {
                        Ok(()) => self.autostart_error = None,
                        Err(e) => {
                            self.autostart = before;
                            self.autostart_error = Some(format!("Não deu para alterar: {e}"));
                        }
                    }
                }
                if let Some(e) = &self.autostart_error {
                    ui.label(egui::RichText::new(e).size(12.0).color(ALERT));
                }

                ui.with_layout(egui::Layout::bottom_up(egui::Align::Min), |ui| {
                    ui.horizontal(|ui| {
                        ui.label(
                            egui::RichText::new("Fechar a janela mantém o app rodando na bandeja.")
                                .size(11.5)
                                .color(INK_3),
                        );
                        ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                            let hide = egui::Button::new(egui::RichText::new("Ocultar").size(12.0).color(INK))
                                .stroke(egui::Stroke::new(1.0, RULE))
                                .fill(PANEL)
                                .corner_radius(egui::CornerRadius::same(3));
                            if ui.add(hide).clicked() {
                                window::hide(&self.shared);
                            }
                        });
                    });
                    ui.add_space(4.0);
                    ui.horizontal(|ui| {
                        ui.label(egui::RichText::new("48 kHz · estéreo").monospace().size(10.5).color(INK_3));
                        ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                            let link = egui::Button::new(
                                egui::RichText::new("Gerar novo código").size(12.0).color(SIGNAL),
                            )
                            .frame(false);
                            if ui.add(link).clicked() {
                                let t = new_token();
                                save_token(&t);
                                *self.shared.token.lock().unwrap() = t;
                                // Quem estava pareado com o código antigo cai.
                                self.shared.clients.lock().unwrap().clear();
                            }
                        });
                    });
                });
            });
    }
}

// ---------------------------------------------------------------- desinstalação

/// Chamado por "Aplicativos instalados" do Windows (`--uninstall`), com o
/// registro que o instalador criou.
mod uninstall {
    use std::io::Write;
    use std::net::TcpStream;
    use std::os::windows::process::CommandExt;
    use std::path::PathBuf;
    use std::time::{Duration, Instant};
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        MessageBoxW, IDYES, MB_ICONINFORMATION, MB_ICONQUESTION, MB_OK, MB_YESNO,
    };

    const TITLE: &str = "MyScreen Áudio";
    const CREATE_NO_WINDOW: u32 = 0x0800_0000;

    fn wide(s: &str) -> Vec<u16> {
        s.encode_utf16().chain(std::iter::once(0)).collect()
    }

    fn message(text: &str, flags: u32) -> i32 {
        unsafe { MessageBoxW(std::ptr::null_mut(), wide(text).as_ptr(), wide(TITLE).as_ptr(), flags) }
    }

    /// Fecha a cópia que estiver rodando e espera a porta liberar.
    pub fn close_running() {
        if let Ok(mut s) = TcpStream::connect(("127.0.0.1", super::PORT)) {
            let _ = s.write_all(b"QUIT");
        }
        let t = Instant::now();
        while t.elapsed() < Duration::from_secs(4) {
            if TcpStream::connect(("127.0.0.1", super::PORT)).is_err() {
                return;
            }
            std::thread::sleep(Duration::from_millis(150));
        }
    }

    pub fn run() {
        if message("Remover o MyScreen Áudio deste computador?", MB_YESNO | MB_ICONQUESTION) != IDYES {
            return;
        }
        close_running();
        let _ = super::autostart::set(false);
        let hkcu = winreg::RegKey::predef(winreg::enums::HKEY_CURRENT_USER);
        let _ = hkcu.delete_subkey_all(r"Software\Microsoft\Windows\CurrentVersion\Uninstall\MyScreenAudio");
        if let Some(appdata) = std::env::var_os("APPDATA").map(PathBuf::from) {
            let _ = std::fs::remove_file(
                appdata.join(r"Microsoft\Windows\Start Menu\Programs\MyScreen Áudio.lnk"),
            );
            let _ = std::fs::remove_dir_all(appdata.join("MyScreenAudio"));
        }
        // O exe em execução não pode se apagar: um `cmd` destacado apaga a
        // pasta depois que este processo sair.
        if let Some(dir) = std::env::current_exe().ok().and_then(|e| e.parent().map(|d| d.to_path_buf())) {
            if dir.ends_with("MyScreenAudio") {
                let _ = std::process::Command::new("cmd")
                    .raw_arg(format!(
                        "/c ping 127.0.0.1 -n 3 > nul & rmdir /s /q \"{}\"",
                        dir.display()
                    ))
                    .creation_flags(CREATE_NO_WINDOW)
                    .spawn();
            }
        }
        message("O MyScreen Áudio foi removido.", MB_OK | MB_ICONINFORMATION);
    }
}

fn main() -> eframe::Result {
    if std::env::args().any(|a| a == "--uninstall") {
        uninstall::run();
        return Ok(());
    }
    // Porta ocupada = o app já está rodando (talvez escondido): pede para ele
    // aparecer e sai, em vez de abrir uma segunda cópia que não funcionaria.
    let listener = match TcpListener::bind(("127.0.0.1", PORT)) {
        Ok(l) => l,
        Err(_) => {
            if let Ok(mut s) = TcpStream::connect(("127.0.0.1", PORT)) {
                let _ = s.write_all(b"SHOW");
            }
            return Ok(());
        }
    };
    let start_hidden = std::env::args().any(|a| a == "--hidden");
    let prefs = load_prefs();

    let shared = Arc::new(Shared {
        clients: Mutex::new(Vec::new()),
        token: Mutex::new(load_or_create_token()),
        exclude_chrome: AtomicBool::new(prefs.exclude_chrome),
        exclude_discord: AtomicBool::new(prefs.exclude_discord),
        gain: AtomicU32::new((prefs.gain_pct / 100.0).to_bits()),
        normalize: AtomicBool::new(prefs.normalize),
        agc: Mutex::new(Agc::new()),
        agc_db: AtomicU32::new(0f32.to_bits()),
        generation: AtomicU64::new(0),
        level: AtomicU32::new(0),
        error: Mutex::new(None),
        hwnd: AtomicIsize::new(0),
        quitting: AtomicBool::new(false),
        egui_ctx: Mutex::new(None),
    });

    {
        let s = shared.clone();
        thread::spawn(move || run_server(listener, s));
    }
    {
        let s = shared.clone();
        thread::spawn(move || run_capture(s));
    }

    let options = eframe::NativeOptions {
        viewport: egui::ViewportBuilder::default()
            .with_title("MyScreen Áudio")
            .with_inner_size([400.0, 490.0])
            .with_resizable(false)
            .with_maximize_button(false)
            .with_visible(!start_hidden)
            .with_icon(egui::IconData { rgba: icon_rgba(64), width: 64, height: 64 }),
        ..Default::default()
    };
    eframe::run_native(
        "MyScreen Áudio",
        options,
        Box::new(move |cc| {
            let mut visuals = egui::Visuals::dark();
            visuals.panel_fill = BG;
            visuals.selection.bg_fill = egui::Color32::from_rgb(0x1b, 0x3a, 0x7d);
            cc.egui_ctx.set_visuals(visuals);

            use raw_window_handle::{HasWindowHandle, RawWindowHandle};
            if let Ok(h) = cc.window_handle() {
                if let RawWindowHandle::Win32(w) = h.as_raw() {
                    shared.hwnd.store(w.hwnd.get(), Ordering::SeqCst);
                }
            }
            create_tray(shared.clone());
            *shared.egui_ctx.lock().unwrap() = Some(cc.egui_ctx.clone());

            Ok(Box::new(App {
                shared,
                exclude_chrome: prefs.exclude_chrome,
                exclude_discord: prefs.exclude_discord,
                normalize: prefs.normalize,
                gain_pct: prefs.gain_pct,
                autostart: autostart::is_enabled(),
                autostart_error: None,
                copied_at: None,
            }))
        }),
    )
}
