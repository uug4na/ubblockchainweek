// Inlined into <head> by the root layout (server side, so it can't live in the client
// ThemeSwitch module): applies a saved Light/Dark choice before first paint.
export const THEME_KEY = "ubbw.theme";
export const themeBootScript = `try{var t=localStorage.getItem("${THEME_KEY}");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;
