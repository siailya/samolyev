// Synchronous, before CSS: root routing and the initial palette only.
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
  const preferredLanguage = (saved, languages) =>
    saved === "en" || saved === "ru"
      ? saved
      : languages.find((language) => /^(ru|en)(-|$)/i.test(language)) || "en";
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
    preferredLanguage,
    validTheme,
    getTheme: () => theme,
    setTheme(value) {
      theme = validTheme(value);
      write("theme", theme);
      applyTheme();
    },
  };
  if (location.pathname === "/" || location.pathname === "/index.html") {
    const language = preferredLanguage(
      read("language"),
      navigator.languages?.length ? navigator.languages : [navigator.language || "en"],
    );
    if (/^ru/i.test(language)) location.replace("/ru/");
  }
})();
