# MyScreen Áudio (Windows)

App de bandeja que captura o som do PC e entrega para a aba do MyScreen, que o
publica como o áudio do compartilhamento de tela.

Existe porque o Chrome no Windows não captura o som do sistema quando a saída
padrão tem mais de 2 canais (fone 7.1, por exemplo): o `getDisplayMedia` falha
com `NotReadableError`. O app usa o loopback por processo do Windows, captura
no formato nativo do dispositivo e mistura para estéreo sem a perda de ~14 dB
da conversão automática do Windows.

## Como funciona

- WebSocket em `ws://127.0.0.1:47810/?code=<código>`; aceita só a origem do
  MyScreen e o código de pareamento mostrado no app.
- Cada mensagem: PCM 16 bits, estéreo intercalado, 48 kHz, 10 ms.
- O lado do site está em `src/components/conference/companionAudio.ts`.
- Opções: ignorar o som do Chrome e/ou do Discord, normalização de volume,
  volume enviado, iniciar com o Windows. Fechar a janela mantém o app na bandeja.

## Gerar o instalador

Precisa do Rust (stable). Em `companion/`:

```powershell
.\build.ps1
```

Saída: `target\release\MyScreenAudio-Setup.exe` (o app vai embutido).
O instalador é por usuário (sem administrador), cria atalho no Menu Iniciar,
registra em "Aplicativos instalados" e atualiza uma instalação existente.
`MyScreenAudio-Setup.exe --silent [--no-autostart]` instala sem janela.

O exe não é assinado: na primeira execução o Windows SmartScreen mostra um
aviso ("Mais informações" → "Executar assim mesmo").
