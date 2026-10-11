const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const source = fs.readFileSync("init.js", "utf8");
const pages = [
  "index.html",
  "en/index.html",
  "ru/index.html",
  "en/experience.html",
  "ru/experience.html",
];
function browser({
  pathname = "/",
  languages = ["en-US"],
  saved = {},
  dark = false,
  blocked = false,
} = {}) {
  const storage = { ...saved };
  const media = {
    matches: dark,
    addEventListener(_, fn) {
      this.change = fn;
    },
  };
  const redirects = [];
  const context = {
    window: { matchMedia: () => media },
    document: { documentElement: { dataset: {} } },
    navigator: { languages, language: languages[0] },
    location: { pathname, replace: (url) => redirects.push(url) },
    localStorage: {
      getItem(key) {
        if (blocked) throw Error("blocked");
        return storage[key] ?? null;
      },
      setItem(key, value) {
        if (blocked) throw Error("blocked");
        storage[key] = value;
      },
    },
  };
  vm.createContext(context);
  vm.runInContext(source, context);
  return {
    context,
    media,
    redirects,
    storage,
    preferences: context.window.sitePreferences,
    theme: () => context.document.documentElement.dataset.theme,
  };
}
test("root stays English regardless of saved or browser language", () => {
  for (const pathname of ["/", "/index.html"]) {
    for (const languages of [["ru-RU"], ["de", "RU-ru"], ["en", "ru"], ["fr"], []]) {
      for (const language of ["ru", "en", "invalid", undefined]) {
        for (const blocked of [false, true]) {
          assert.deepEqual(
            browser({ pathname, languages, saved: { language }, blocked }).redirects,
            [],
          );
        }
      }
    }
  }
});
test("explicit locales and missing URLs never auto-redirect", () => {
  for (const pathname of [
    "/en",
    "/en/",
    "/ru",
    "/ru/",
    "/en/index.html",
    "/ru/index.html",
    "/experience",
    "/experience/",
    "/ru/experience",
    "/ru/experience/",
    "/en/experience.html",
    "/ru/experience.html",
    "/missing",
  ]) {
    assert.deepEqual(
      browser({ pathname, languages: ["ru"], saved: { language: "ru" } }).redirects,
      [],
    );
  }
});
test("system theme initializes and updates; manual override persists until system is chosen", () => {
  const b = browser({ dark: true });
  assert.equal(b.theme(), "dark");
  b.media.matches = false;
  b.media.change();
  assert.equal(b.theme(), "light");
  b.preferences.setTheme("dark");
  assert.equal(b.storage.theme, "dark");
  b.media.change();
  assert.equal(b.theme(), "dark");
  b.preferences.setTheme("light");
  b.media.matches = true;
  b.media.change();
  assert.equal(b.theme(), "light");
  b.preferences.setTheme("system");
  assert.equal(b.theme(), "dark");
  assert.equal(browser({ saved: { theme: "light" }, dark: true }).theme(), "light");
  assert.equal(browser({ saved: { theme: "invalid" }, dark: true }).theme(), "dark");
});
test("blocked localStorage leaves explicit navigation and theme controls functional", () => {
  const b = browser({ blocked: true, languages: ["ru"] });
  assert.deepEqual(b.redirects, []);
  b.preferences.setTheme("dark");
  assert.equal(b.theme(), "dark");
  b.preferences.write("language", "en");
});
test("explicit language switches save preference without routing the root", () => {
  const b = browser({ pathname: "/ru", languages: ["ru"] });
  const link = {
    lang: "en",
    addEventListener(_, handler) {
      this.click = handler;
    },
  };
  b.context.document.querySelectorAll = () => [link];
  b.context.document.querySelector = () => null;
  b.context.window.matchMedia = () => ({ matches: true });
  vm.runInContext(fs.readFileSync("language.js", "utf8"), b.context);
  link.click();
  assert.equal(b.storage.language, "en");
  assert.deepEqual(browser({ languages: ["ru"], saved: b.storage }).redirects, []);
});
test("all content is available without JS, initialization precedes CSS, local URLs exist", () => {
  for (const file of pages) {
    const html = fs.readFileSync(file, "utf8");
    assert.ok(html.indexOf('src="/init.js"') < html.indexOf('rel="stylesheet"'));
    assert.match(html, /<script src="\/init.js"><\/script>/);
    assert.match(html, /<main>/);
    assert.match(html, /Magnit/);
    assert.match(html, /Neutron Agency/);
    assert.doesNotMatch(html, /http-equiv="refresh"|<main[^>]*hidden/);
    for (const contact of [
      "https://github.com/siailya",
      "https://t.me/siailya",
      "https://www.linkedin.com/in/siailya",
    ]) {
      assert.ok(html.slice(html.indexOf("<footer>")).includes(contact));
    }
    assert.match(html, /<button\s+id="theme"\s+class="theme-control"\s+type="button"/);
    for (const [, url] of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
      if (/^https?:/.test(url)) continue;
      assert.ok(url.startsWith("/"), `${file}: root-relative URL required: ${url}`);
      const routes = {
        "/": "index.html",
        "/ru": "ru/index.html",
        "/experience": "en/experience.html",
        "/ru/experience": "ru/experience.html",
      };
      const target = routes[url] ?? url.slice(1);
      assert.ok(fs.existsSync(target), `${file}: ${url}`);
      if (!/\.(css|js|ico|png)$/.test(url)) {
        assert.ok(Object.hasOwn(routes, url), `${file}: noncanonical page URL: ${url}`);
      }
    }
    if (!file.includes("experience")) {
      assert.match(html, /<a href="https:\/\/t.me\/siailya">@siailya<\/a> \/ @samolyev/);
      assert.match(html, /piece="planet"/);
      assert.match(html, /ascii.rest@0.4.0\/dist\/ascii.js/);
      assert.match(html, /integrity="sha384-/);
    } else assert.match(html, /Kafka/);
  }
  const root = fs.readFileSync("index.html", "utf8");
  const en = fs.readFileSync("en/index.html", "utf8");
  assert.equal(
    root.slice(root.indexOf('<div class="hero">'), root.indexOf("<footer>")),
    en.slice(en.indexOf('<div class="hero">'), en.indexOf("<footer>")),
  );
  const css = fs.readFileSync("style.css", "utf8");
  assert.match(css, /:root:not\(\[data-theme\]\)/);
  assert.doesNotMatch(css, /opacity:\s*0(?:;|\s)|visibility:\s*hidden/);
});
test("every page declares its canonical URL and explicit locale links", () => {
  for (const file of pages) {
    const html = fs.readFileSync(file, "utf8");
    const ru = file.startsWith("ru/");
    const detail = file.includes("experience");
    const canonical = detail ? `${ru ? "/ru" : ""}/experience` : ru ? "/ru" : "/";
    assert.equal((html.match(/rel="canonical"/g) ?? []).length, 1);
    assert.ok(html.includes(`rel="canonical" href="https://samolyev.ru${canonical}"`));
    const alternate = html.match(
      /<link rel="alternate" hreflang="(ru|en)" href="([^"]+)"/,
    );
    assert.equal(alternate[1], ru ? "en" : "ru");
    assert.equal(
      alternate[2],
      detail ? `${ru ? "" : "/ru"}/experience` : ru ? "/" : "/ru",
    );
    const switches = html.match(/<nav class="langs"[^>]*>([\s\S]*?)<\/nav>/)[1];
    for (const locale of ["ru", "en"]) {
      const target = detail
        ? `${locale === "ru" ? "/ru" : ""}/experience`
        : locale === "ru"
          ? "/ru"
          : "/";
      assert.match(switches, new RegExp(`href="${target}"[^>]*lang="${locale}"`));
    }
    assert.doesNotMatch(html, /href="[^"]*\.html(?:[?#][^"]*)?"/);
  }
});

test("container has an explicit public asset allowlist and CI publishes only after checks", () => {
  const docker = fs.readFileSync("Dockerfile", "utf8");
  assert.match(docker, /FROM nginxinc\/nginx-unprivileged:1\.28\.0-alpine-slim/);
  assert.match(docker, /USER 101/);
  assert.match(docker, /ARG SITE_REVISION=unknown/);
  assert.match(docker, /org.opencontainers.image.revision="\$SITE_REVISION"/);
  assert.ok(
    docker.includes(
      "USER 0\nRUN printf '%s\\n' \"$SITE_REVISION\" > /usr/share/nginx/html/revision.txt\nUSER 101",
    ),
  );
  assert.doesNotMatch(docker, /COPY\s+\.\s|node_modules|README|\.git/);
  for (const line of docker.split("\n").filter((line) => line.startsWith("COPY "))) {
    for (const file of line.split(" ").slice(1, -1)) assert.ok(fs.existsSync(file), file);
  }
  const ci = fs.readFileSync(".github/workflows/site.yml", "utf8");
  assert.match(ci, /if: github.event_name != 'pull_request'/);
  assert.match(ci, /needs: checks/);
  assert.equal((ci.match(/packages: write/g) || []).length, 1);
  assert.match(ci, /ghcr.io\/siailya\/samolyev-site:latest/);
  assert.match(ci, /ghcr.io\/siailya\/samolyev-site:sha-\$\{\{ github.sha \}\}/);
});

test("reveals are optional, subtle and cancelled when reduced motion changes", () => {
  const b = browser();
  const motion = {
    matches: false,
    addEventListener(_, fn) {
      this.change = fn;
    },
  };
  const observed = [];
  let observer;
  let animation;
  b.context.window.matchMedia = () => motion;
  b.context.document.querySelector = () => null;
  const target = {
    animate(frames, options) {
      assert.equal(options.duration, 240);
      assert.equal(frames[0].transform, "translateY(4px)");
      assert.ok(frames[0].opacity > 0);
      animation = {
        cancel() {
          this.cancelled = true;
        },
      };
      return animation;
    },
  };
  b.context.document.querySelectorAll = (selector) =>
    selector === ".langs a" ? [] : [target];
  b.context.Element = { prototype: { animate() {} } };
  b.context.window.IntersectionObserver = b.context.IntersectionObserver = class {
    constructor(fn) {
      this.callback = fn;
      observer = this;
    }
    observe(element) {
      observed.push(element);
    }
    unobserve() {}
    disconnect() {
      this.disconnected = true;
    }
  };
  vm.runInContext(fs.readFileSync("language.js", "utf8"), b.context);
  assert.equal(observed.length, 1);
  observer.callback([{ target, isIntersecting: true }]);
  motion.matches = true;
  motion.change();
  assert.equal(animation.cancelled, true);
  assert.equal(observer.disconnected, true);
});

test("reduced motion prevents reveals from being initialized", () => {
  const b = browser();
  b.context.document.querySelector = () => null;
  b.context.document.querySelectorAll = () => [];
  b.context.window.matchMedia = () => ({ matches: true });
  b.context.window.IntersectionObserver = b.context.IntersectionObserver = class {
    constructor() {
      assert.fail("no observer should be initialized");
    }
  };
  vm.runInContext(fs.readFileSync("language.js", "utf8"), b.context);
});
