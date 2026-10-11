const preferences = window.sitePreferences;
document.querySelectorAll(".langs a").forEach((link) => {
  link.addEventListener("click", () => preferences?.write("language", link.lang));
});
const themeControl = document.querySelector("#theme");
if (themeControl && preferences) {
  themeControl.value = preferences.getTheme();
  themeControl.addEventListener("change", () => preferences.setTheme(themeControl.value));
  themeControl.closest("label").hidden = false;
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
