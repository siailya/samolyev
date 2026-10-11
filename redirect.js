let saved;
try {
  saved = localStorage.getItem("language");
} catch {
  // Browser language remains available without persistent storage.
}
const preferred =
  saved === "ru" || saved === "en"
    ? saved
    : (navigator.languages || [navigator.language]).find((language) =>
        /^(ru|en)(-|$)/i.test(language),
      ) || "en";
location.replace((/^ru/i.test(preferred) ? "ru" : "en") + "/index.html");
