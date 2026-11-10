//! Janelas flutuantes "sempre no topo" que continuam por cima de um jogo.
//!
//! Por que não basta o `setAlwaysOnTop` do Electron: muitos jogos (PUBG,
//! qualquer um em tela cheia sem bordas) se põem como HWND_TOPMOST quando
//! ganham o foco. Entre janelas TOPMOST vale a ordem da última chamada, então
//! o jogo passa na frente da câmera flutuante. E ele faz isso alguns
//! milissegundos DEPOIS de ficar em primeiro plano, quando a janela flutuante
//! (que nem tinha o foco) já não recebe evento nenhum.
//!
//! Aqui uma thread própria escuta a troca de primeiro plano do sistema
//! (`EVENT_SYSTEM_FOREGROUND`) e reafirma o topo das janelas fixadas numa
//! rajada curta, para ganhar do jogo que se reafirma depois. Fora da rajada,
//! a cada ~0,5 s confere se alguma janela de outro processo está de fato
//! cobrindo a flutuante e só então a sobe de novo. Nunca rouba o foco
//! (`SWP_NOACTIVATE`) e nunca trava a thread de interface do app
//! (`SWP_ASYNCWINDOWPOS`).
//!
//! Tela cheia EXCLUSIVA sem as otimizações de tela cheia do Windows não
//! mostra janela nenhuma por cima — isso é do sistema, não do MyScreen.

#[cfg(windows)]
pub mod sys {
    use std::sync::atomic::{AtomicU32, AtomicU64, Ordering};
    use std::sync::Mutex;
    use windows_sys::Win32::Foundation::{HWND, RECT};
    use windows_sys::Win32::Graphics::Dwm::{DwmGetWindowAttribute, DWMWA_CLOAKED};
    use windows_sys::Win32::System::SystemInformation::GetTickCount64;
    use windows_sys::Win32::System::Threading::GetCurrentThreadId;
    use windows_sys::Win32::UI::Accessibility::{SetWinEventHook, UnhookWinEvent, HWINEVENTHOOK};
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        GetMessageW, GetWindow, GetWindowLongW, GetWindowRect, GetWindowThreadProcessId, IsIconic, IsWindow,
        IsWindowVisible, KillTimer, PostThreadMessageW, SetTimer, SetWindowPos, EVENT_SYSTEM_FOREGROUND,
        EVENT_SYSTEM_MINIMIZEEND, GWL_EXSTYLE, GW_HWNDPREV, HWND_TOPMOST, MSG, SWP_ASYNCWINDOWPOS,
        SWP_NOACTIVATE, SWP_NOMOVE, SWP_NOOWNERZORDER, SWP_NOSIZE, WINEVENT_OUTOFCONTEXT,
        WINEVENT_SKIPOWNPROCESS, WM_QUIT, WM_TIMER, WS_EX_TOPMOST, WS_EX_TRANSPARENT,
    };

    /// Intervalo do relógio da thread.
    const TICK_MS: u32 = 100;
    /// Depois de uma troca de primeiro plano, reafirma o topo a cada tique por este tempo.
    const BURST_MS: u64 = 1500;
    /// Fora da rajada, confere a cobertura a cada N tiques.
    const CHECK_EVERY_TICKS: u64 = 5;
    /// Limite de janelas percorridas acima da flutuante (a pilha TOPMOST é curta).
    const MAX_WALK: usize = 256;

    static PINNED: Mutex<Vec<isize>> = Mutex::new(Vec::new());
    static THREAD: AtomicU32 = AtomicU32::new(0);
    static BURST_UNTIL: AtomicU64 = AtomicU64::new(0);
    static TICKS: AtomicU64 = AtomicU64::new(0);

    fn pinned() -> Vec<isize> {
        let mut list = PINNED.lock().unwrap();
        list.retain(|&h| unsafe { IsWindow(h as HWND) } != 0);
        list.clone()
    }

    unsafe fn raise(hwnd: HWND) {
        if IsWindowVisible(hwnd) == 0 || IsIconic(hwnd) != 0 {
            return;
        }
        SetWindowPos(
            hwnd,
            HWND_TOPMOST,
            0,
            0,
            0,
            0,
            SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE | SWP_NOOWNERZORDER | SWP_ASYNCWINDOWPOS,
        );
    }

    unsafe fn cloaked(hwnd: HWND) -> bool {
        let mut value: u32 = 0;
        DwmGetWindowAttribute(hwnd, DWMWA_CLOAKED as u32, &mut value as *mut u32 as *mut _, 4) == 0 && value != 0
    }

    fn intersects(a: &RECT, b: &RECT) -> bool {
        a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom
    }

    /// Alguma janela visível de outro processo, acima na ordem Z, cobre esta?
    unsafe fn covered(hwnd: HWND) -> bool {
        let mut own_pid = 0u32;
        GetWindowThreadProcessId(hwnd, &mut own_pid);
        let mut mine: RECT = std::mem::zeroed();
        if GetWindowRect(hwnd, &mut mine) == 0 {
            return false;
        }
        let mut h = GetWindow(hwnd, GW_HWNDPREV);
        let mut walked = 0;
        while !h.is_null() && walked < MAX_WALK {
            walked += 1;
            let ex = GetWindowLongW(h, GWL_EXSTYLE) as u32;
            // Fora da pilha TOPMOST ninguém fica acima de quem é TOPMOST:
            // chegou aqui, a flutuante já está por cima do resto.
            if ex & WS_EX_TOPMOST == 0 {
                return false;
            }
            let mut pid = 0u32;
            GetWindowThreadProcessId(h, &mut pid);
            // Camadas que deixam o clique passar (overlays de GPU, Game Bar) não escondem nada de fato.
            let overlay = ex & WS_EX_TRANSPARENT != 0;
            if pid != own_pid && !overlay && IsWindowVisible(h) != 0 && !cloaked(h) {
                let mut r: RECT = std::mem::zeroed();
                if GetWindowRect(h, &mut r) != 0 && intersects(&mine, &r) {
                    return true;
                }
            }
            h = GetWindow(h, GW_HWNDPREV);
        }
        false
    }

    fn now() -> u64 {
        unsafe { GetTickCount64() }
    }

    unsafe extern "system" fn on_event(
        _hook: HWINEVENTHOOK,
        _event: u32,
        _hwnd: HWND,
        _id_object: i32,
        _id_child: i32,
        _thread: u32,
        _time: u32,
    ) {
        BURST_UNTIL.store(now() + BURST_MS, Ordering::Relaxed);
        for h in pinned() {
            raise(h as HWND);
        }
    }

    fn tick() {
        let t = TICKS.fetch_add(1, Ordering::Relaxed);
        let in_burst = now() < BURST_UNTIL.load(Ordering::Relaxed);
        if !in_burst && t % CHECK_EVERY_TICKS != 0 {
            return;
        }
        for h in pinned() {
            unsafe {
                if in_burst || covered(h as HWND) {
                    raise(h as HWND);
                }
            }
        }
    }

    fn start() -> Result<(), String> {
        if THREAD.load(Ordering::SeqCst) != 0 {
            return Ok(());
        }
        let (tx, rx) = std::sync::mpsc::channel::<Result<u32, String>>();
        std::thread::Builder::new()
            .name("myscreen-topmost".into())
            .spawn(move || unsafe {
                let flags = WINEVENT_OUTOFCONTEXT | WINEVENT_SKIPOWNPROCESS;
                let fg = SetWinEventHook(EVENT_SYSTEM_FOREGROUND, EVENT_SYSTEM_FOREGROUND, std::ptr::null_mut(), Some(on_event), 0, 0, flags);
                // Jogo restaurado de minimizado nem sempre troca o primeiro plano antes de se pôr no topo.
                let restore =
                    SetWinEventHook(EVENT_SYSTEM_MINIMIZEEND, EVENT_SYSTEM_MINIMIZEEND, std::ptr::null_mut(), Some(on_event), 0, 0, flags);
                if fg.is_null() {
                    let _ = tx.send(Err("SetWinEventHook falhou".into()));
                    return;
                }
                let timer = SetTimer(std::ptr::null_mut(), 0, TICK_MS, None);
                let _ = tx.send(Ok(GetCurrentThreadId()));
                let mut msg: MSG = std::mem::zeroed();
                while GetMessageW(&mut msg, std::ptr::null_mut(), 0, 0) > 0 {
                    if msg.message == WM_TIMER {
                        tick();
                    }
                }
                KillTimer(std::ptr::null_mut(), timer);
                UnhookWinEvent(fg);
                if !restore.is_null() {
                    UnhookWinEvent(restore);
                }
            })
            .map_err(|e| e.to_string())?;
        match rx.recv() {
            Ok(Ok(id)) => {
                THREAD.store(id, Ordering::SeqCst);
                Ok(())
            }
            Ok(Err(e)) => Err(e),
            Err(e) => Err(e.to_string()),
        }
    }

    fn stop() {
        let id = THREAD.swap(0, Ordering::SeqCst);
        if id != 0 {
            unsafe {
                PostThreadMessageW(id, WM_QUIT, 0, 0);
            }
        }
    }

    pub fn pin(hwnd: isize) -> Result<(), String> {
        {
            let mut list = PINNED.lock().unwrap();
            if !list.contains(&hwnd) {
                list.push(hwnd);
            }
        }
        unsafe { raise(hwnd as HWND) };
        start()
    }

    pub fn unpin(hwnd: isize) {
        let empty = {
            let mut list = PINNED.lock().unwrap();
            list.retain(|&h| h != hwnd);
            list.is_empty()
        };
        if empty {
            stop();
        }
    }
}
