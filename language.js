const preferences = window.sitePreferences;
document.querySelectorAll(".langs a").forEach((link) => {
  link.addEventListener("click", () => preferences?.write("language", link.lang));
});
const themeControl = document.querySelector("#theme");
if (themeControl && preferences) {
  const themes = ["system", "light", "dark"];
  const labels =
    document.documentElement.lang === "ru"
      ? { system: "Системная", light: "Светлая", dark: "Тёмная" }
      : { system: "System", light: "Light", dark: "Dark" };
  // Lucide monitor, sun and moon; see THIRD_PARTY_LICENSES.txt.
  const icons = {
    system:
      '<rect width="20" height="14" x="2" y="3" rx="2" /><line x1="8" x2="16" y1="21" y2="21" /><line x1="12" x2="12" y1="17" y2="21" />',
    light:
      '<circle cx="12" cy="12" r="4" /><path d="M12 2v2" /><path d="M12 20v2" /><path d="m4.93 4.93 1.41 1.41" /><path d="m17.66 17.66 1.41 1.41" /><path d="M2 12h2" /><path d="M20 12h2" /><path d="m6.34 17.66-1.41 1.41" /><path d="m19.07 4.93-1.41 1.41" />',
    dark: '<path d="M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401" />',
  };
  const nextTheme = () =>
    themes[(themes.indexOf(preferences.getTheme()) + 1) % themes.length];
  const updateThemeControl = () => {
    const theme = preferences.getTheme();
    const label =
      document.documentElement.lang === "ru"
        ? `Тема: ${labels[theme]}. Переключить на: ${labels[nextTheme()]}`
        : `Theme: ${labels[theme]}. Switch to: ${labels[nextTheme()]}`;
    themeControl.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${icons[theme]}</svg>`;
    themeControl.setAttribute("aria-label", label);
    themeControl.title = label;
  };
  themeControl.addEventListener("click", () => {
    preferences.setTheme(nextTheme());
    updateThemeControl();
  });
  updateThemeControl();
  themeControl.hidden = false;
}
// Animate visible content without ever depending on JS to reveal it.
const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
if (!motion.matches && "IntersectionObserver" in window && Element.prototype.animate) {
  const active = new Set();
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      observer.unobserve(entry.target);
      if (motion.matches) continue;
      const animation = entry.target.animate(
        [
          { opacity: 0.88, transform: "translateY(4px)" },
          { opacity: 1, transform: "none" },
        ],
        { duration: 240, easing: "ease-out" },
      );
      active.add(animation);
      animation.onfinish = () => active.delete(animation);
    }
  });
  document
    .querySelectorAll(".hero, .experience, .ai, article")
    .forEach((element) => observer.observe(element));
  motion.addEventListener("change", () => {
    if (motion.matches) {
      observer.disconnect();
      active.forEach((animation) => animation.cancel());
      active.clear();
    }
  });
}
