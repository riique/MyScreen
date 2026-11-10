export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "myscreen-theme";

/**
 * Roda antes da primeira pintura, inline no <head>. Sem isto o tema escuro
 * pisca em branco a cada carga. O padrão é branco: o escuro só entra quando a
 * pessoa escolheu.
 */
export const themeBootScript = `(function(){try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");if(t==="dark")document.documentElement.dataset.theme="dark";}catch(e){}})();`;
