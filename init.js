// Synchronous, before CSS: apply the saved or system palette.
(() => {
  const read = (key) => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  };
  const write = (key, value) => {
    try {
      localStorage.setItem(key, value);
    } catch {
      // Current-page controls and direct links still work without storage.
    }
  };
  const validTheme = (value) =>
    ["light", "dark", "system"].includes(value) ? value : "system";
  const themeMedia = window.matchMedia("(prefers-color-scheme: dark)");
  let theme = validTheme(read("theme"));
  const applyTheme = () => {
    document.documentElement.dataset.theme =
      theme === "system" ? (themeMedia.matches ? "dark" : "light") : theme;
  };
  applyTheme();
  themeMedia.addEventListener("change", applyTheme);
  window.sitePreferences = {
    read,
    write,
    validTheme,
    getTheme: () => theme,
    setTheme(value) {
      theme = validTheme(value);
      write("theme", theme);
      applyTheme();
    },
  };
})();
