document.querySelectorAll(".langs a").forEach((link) => {
  link.addEventListener("click", () => {
    try {
      localStorage.setItem("language", link.lang);
    } catch {
      // Direct language links also work when storage is unavailable.
    }
  });
});
