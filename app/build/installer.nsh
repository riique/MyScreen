; Textos do instalador (assistente do electron-builder).
; Atualizações rodam em modo silencioso (/S) e não passam por nenhuma destas telas.

!macro customWelcomePage
  !insertmacro skipPageIfUpdated
  !define MUI_WELCOMEPAGE_TITLE "Bem-vindo ao MyScreen"
  !define MUI_WELCOMEPAGE_TITLE_3LINES
  !define MUI_WELCOMEPAGE_TEXT "Compartilhe a tela, o som do sistema e a câmera com quem está na mesma sala.$\r$\n$\r$\nA instalação leva alguns segundos e não pede permissão de administrador.$\r$\n$\r$\nClique em Próximo para continuar."
  !insertmacro MUI_PAGE_WELCOME
!macroend

!define MUI_FINISHPAGE_TITLE "Tudo pronto"
!define MUI_FINISHPAGE_TITLE_3LINES
!define MUI_FINISHPAGE_TEXT "O MyScreen foi instalado. As próximas versões se instalam sozinhas, direto pelo app."
!define MUI_FINISHPAGE_RUN_TEXT "Abrir o MyScreen agora"
