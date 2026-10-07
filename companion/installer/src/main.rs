//! Instalador do MyScreen Áudio.
//!
//! Um exe só, com o app embutido. Instala por usuário (sem administrador) em
//! `%LOCALAPPDATA%\Programs\MyScreenAudio`, cria o atalho no Menu Iniciar,
//! registra em "Aplicativos instalados" (com desinstalar) e, se a pessoa
//! quiser, liga a inicialização com o Windows. Rodar de novo atualiza.
//!
//! Gere o app antes: `cargo build --release` em `companion/` e depois
//! `cargo build --release --target-dir ../target` aqui (ou `build.ps1`).

#![windows_subsystem = "windows"]

use std::io::Write;
use std::net::TcpStream;
use std::os::windows::process::CommandExt;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use eframe::egui;

const APP_EXE: &[u8] = include_bytes!(concat!(
    env!("CARGO_MANIFEST_DIR"),
    "/../target/release/myscreen-audio.exe"
));
const VERSION: &str = env!("CARGO_PKG_VERSION");
const PORT: u16 = 47810;
const KEY: &str = "MyScreenAudio";
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

fn install_dir() -> PathBuf {
    let base = std::env::var_os("LOCALAPPDATA").map(PathBuf::from).unwrap_or_else(std::env::temp_dir);
    base.join("Programs").join("MyScreenAudio")
}

fn shortcut_path() -> Option<PathBuf> {
    std::env::var_os("APPDATA")
        .map(PathBuf::from)
        .map(|p| p.join(r"Microsoft\Windows\Start Menu\Programs\MyScreen Áudio.lnk"))
}

fn installed_exe() -> PathBuf {
    install_dir().join("MyScreenAudio.exe")
}

/// Fecha o app se estiver aberto (é uma atualização) e espera a porta soltar.
fn close_running() {
    if let Ok(mut s) = TcpStream::connect(("127.0.0.1", PORT)) {
        let _ = s.write_all(b"QUIT");
    } else {
        return;
    }
    let t = Instant::now();
    while t.elapsed() < Duration::from_secs(5) {
        if TcpStream::connect(("127.0.0.1", PORT)).is_err() {
            // A porta soltou; dá um respiro para o Windows liberar o exe.
            std::thread::sleep(Duration::from_millis(300));
            return;
        }
        std::thread::sleep(Duration::from_millis(150));
    }
}

fn write_exe(path: &PathBuf) -> Result<(), String> {
    let mut last = String::new();
    for _ in 0..20 {
        match std::fs::write(path, APP_EXE) {
            Ok(()) => return Ok(()),
            Err(e) => last = e.to_string(),
        }
        std::thread::sleep(Duration::from_millis(250));
    }
    Err(format!("Não deu para gravar o programa ({last}). Feche o MyScreen Áudio e tente de novo."))
}

fn create_shortcut(exe: &PathBuf) -> Result<(), String> {
    let Some(lnk) = shortcut_path() else { return Ok(()) };
    let q = |p: &std::path::Path| p.display().to_string().replace('\'', "''");
    let dir = exe.parent().map(q).unwrap_or_default();
    let script = format!(
        "$s=(New-Object -ComObject WScript.Shell).CreateShortcut('{}');$s.TargetPath='{}';$s.WorkingDirectory='{}';$s.Description='MyScreen Áudio';$s.Save()",
        q(&lnk),
        q(exe),
        dir
    );
    let status = std::process::Command::new("powershell")
        .args(["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", &script])
        .creation_flags(CREATE_NO_WINDOW)
        .status()
        .map_err(|e| format!("atalho: {e}"))?;
    if status.success() { Ok(()) } else { Err("Não deu para criar o atalho no Menu Iniciar.".into()) }
}

fn register(exe: &PathBuf, autostart: bool) -> Result<(), String> {
    use winreg::enums::{HKEY_CURRENT_USER, KEY_READ, KEY_WRITE};
    use winreg::RegKey;
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let exe_q = format!("\"{}\"", exe.display());

    let (un, _) = hkcu
        .create_subkey(format!(r"Software\Microsoft\Windows\CurrentVersion\Uninstall\{KEY}"))
        .map_err(|e| format!("registro: {e}"))?;
    let size_kb = (APP_EXE.len() / 1024) as u32;
    let r: std::io::Result<()> = (|| {
        un.set_value("DisplayName", &"MyScreen Áudio")?;
        un.set_value("DisplayVersion", &VERSION)?;
        un.set_value("Publisher", &"MyScreen")?;
        un.set_value("DisplayIcon", &exe_q)?;
        un.set_value("InstallLocation", &install_dir().display().to_string())?;
        un.set_value("UninstallString", &format!("{exe_q} --uninstall"))?;
        un.set_value("NoModify", &1u32)?;
        un.set_value("NoRepair", &1u32)?;
        un.set_value("EstimatedSize", &size_kb)?;
        Ok(())
    })();
    r.map_err(|e| format!("registro: {e}"))?;

    let run = hkcu
        .open_subkey_with_flags(r"Software\Microsoft\Windows\CurrentVersion\Run", KEY_READ | KEY_WRITE)
        .map_err(|e| format!("registro: {e}"))?;
    if autostart {
        run.set_value(KEY, &format!("{exe_q} --hidden")).map_err(|e| format!("registro: {e}"))?;
    } else {
        let _ = run.delete_value(KEY);
    }
    Ok(())
}

fn install(autostart: bool) -> Result<(), String> {
    close_running();
    std::fs::create_dir_all(install_dir()).map_err(|e| format!("pasta: {e}"))?;
    let exe = installed_exe();
    write_exe(&exe)?;
    create_shortcut(&exe)?;
    register(&exe, autostart)?;
    std::process::Command::new(&exe).spawn().map_err(|e| format!("abrir: {e}"))?;
    Ok(())
}

// ---------------------------------------------------------------- interface

const BG: egui::Color32 = egui::Color32::from_rgb(0x10, 0x11, 0x14);
const INK: egui::Color32 = egui::Color32::from_rgb(0xec, 0xec, 0xe8);
const INK_3: egui::Color32 = egui::Color32::from_rgb(0x8e, 0x92, 0x99);
const SIGNAL: egui::Color32 = egui::Color32::from_rgb(0x1b, 0x3a, 0x7d);
const LIVE: egui::Color32 = egui::Color32::from_rgb(0x4c, 0xc3, 0x8a);
const ALERT: egui::Color32 = egui::Color32::from_rgb(0xe0, 0x7a, 0x66);

#[derive(Clone)]
enum State {
    Ready,
    Working,
    Done,
    Failed(String),
}

struct Setup {
    autostart: bool,
    upgrade: bool,
    state: Arc<Mutex<State>>,
}

fn primary(text: &str) -> egui::Button<'static> {
    egui::Button::new(egui::RichText::new(text).size(14.0).color(egui::Color32::WHITE))
        .fill(SIGNAL)
        .corner_radius(egui::CornerRadius::same(3))
        .min_size(egui::vec2(120.0, 34.0))
}

impl eframe::App for Setup {
    fn ui(&mut self, root: &mut egui::Ui, _frame: &mut eframe::Frame) {
        let ctx = root.ctx().clone();
        let state = self.state.lock().unwrap().clone();
        if matches!(state, State::Working) {
            ctx.request_repaint_after(Duration::from_millis(100));
        }

        egui::CentralPanel::default()
            .frame(egui::Frame::new().fill(BG).inner_margin(egui::Margin::same(24)))
            .show(root, |ui| {
                ui.spacing_mut().item_spacing.y = 8.0;
                let title = if self.upgrade { "Atualizar MyScreen Áudio" } else { "Instalar MyScreen Áudio" };
                ui.label(egui::RichText::new(title).size(20.0).strong().color(INK));
                ui.label(
                    egui::RichText::new(
                        "Leva o som do seu PC (jogos, vídeos, música) para o compartilhamento de tela do MyScreen. Funciona com qualquer fone, inclusive 7.1.",
                    )
                    .size(13.0)
                    .color(INK_3),
                );
                ui.add_space(8.0);

                match &state {
                    State::Ready | State::Failed(_) => {
                        ui.checkbox(
                            &mut self.autostart,
                            egui::RichText::new("Iniciar com o Windows (fica na bandeja)").size(13.0).color(INK),
                        );
                        ui.label(
                            egui::RichText::new(format!("Instala só para você, em {}", install_dir().display()))
                                .size(11.0)
                                .color(INK_3),
                        );
                        if let State::Failed(e) = &state {
                            ui.label(egui::RichText::new(e).size(12.0).color(ALERT));
                        }
                        ui.add_space(8.0);
                        let label = if self.upgrade { "Atualizar" } else { "Instalar" };
                        if ui.add(primary(label)).clicked() {
                            *self.state.lock().unwrap() = State::Working;
                            let (st, autostart, c) = (self.state.clone(), self.autostart, ctx.clone());
                            std::thread::spawn(move || {
                                let r = install(autostart);
                                *st.lock().unwrap() = match r {
                                    Ok(()) => State::Done,
                                    Err(e) => State::Failed(e),
                                };
                                c.request_repaint();
                            });
                        }
                    }
                    State::Working => {
                        ui.horizontal(|ui| {
                            ui.spinner();
                            ui.label(egui::RichText::new("Instalando…").size(14.0).color(INK));
                        });
                    }
                    State::Done => {
                        ui.label(egui::RichText::new("Pronto!").size(16.0).strong().color(LIVE));
                        ui.label(
                            egui::RichText::new(
                                "O app já está aberto. Copie o código que aparece nele e cole no MyScreen, em Compartilhar tela > Som do PC > App.",
                            )
                            .size(13.0)
                            .color(INK),
                        );
                        ui.label(
                            egui::RichText::new("Para remover: Configurações > Aplicativos > MyScreen Áudio.")
                                .size(11.5)
                                .color(INK_3),
                        );
                        ui.add_space(8.0);
                        if ui.add(primary("Concluir")).clicked() {
                            ctx.send_viewport_cmd(egui::ViewportCommand::Close);
                        }
                    }
                }
            });
    }
}

/// Mesmo ícone do app: quadrado azul com barras de som.
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

fn main() -> eframe::Result {
    // `--silent [--no-autostart]`: instala sem janela (implantação automatizada).
    let args: Vec<String> = std::env::args().collect();
    if args.iter().any(|a| a == "--silent") {
        let _ = install(!args.iter().any(|a| a == "--no-autostart"));
        return Ok(());
    }
    let options = eframe::NativeOptions {
        viewport: egui::ViewportBuilder::default()
            .with_title("MyScreen Áudio — Instalação")
            .with_inner_size([440.0, 300.0])
            .with_resizable(false)
            .with_maximize_button(false)
            .with_icon(egui::IconData { rgba: icon_rgba(64), width: 64, height: 64 }),
        ..Default::default()
    };
    eframe::run_native(
        "MyScreen Áudio — Instalação",
        options,
        Box::new(|cc| {
            let mut visuals = egui::Visuals::dark();
            visuals.panel_fill = BG;
            visuals.selection.bg_fill = SIGNAL;
            cc.egui_ctx.set_visuals(visuals);
            Ok(Box::new(Setup {
                autostart: true,
                upgrade: installed_exe().exists(),
                state: Arc::new(Mutex::new(State::Ready)),
            }))
        }),
    )
}
