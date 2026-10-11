const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
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
test("root prefers saved language, then ordered supported browser languages", () => {
  for (const pathname of ["/", "/index.html"]) {
    assert.deepEqual(browser({ pathname, languages: ["ru-RU"] }).redirects, ["/ru/"]);
    assert.deepEqual(
      browser({ pathname, languages: ["ru-RU"], saved: { language: "en" } }).redirects,
      [],
    );
    assert.deepEqual(browser({ pathname, saved: { language: "ru" } }).redirects, [
      "/ru/",
    ]);
  }
  assert.deepEqual(
    browser({ languages: ["de", "RU-ru"], saved: { language: "invalid" } }).redirects,
    ["/ru/"],
  );
  assert.deepEqual(browser({ languages: ["en", "ru"] }).redirects, []);
  assert.deepEqual(browser({ languages: ["fr"] }).redirects, []);
  assert.deepEqual(browser({ languages: [], blocked: true }).redirects, []);
});
test("explicit locales and missing URLs never auto-redirect", () => {
  for (const pathname of [
    "/en/",
    "/ru/",
    "/en/index.html",
    "/ru/index.html",
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
test("blocked localStorage leaves routing and theme controls functional", () => {
  const b = browser({ blocked: true, languages: ["ru"] });
  assert.deepEqual(b.redirects, ["/ru/"]);
  b.preferences.setTheme("dark");
  assert.equal(b.theme(), "dark");
  b.preferences.write("language", "en");
});
test("manual English link saves preference which overrides Russian browser on root", () => {
  const b = browser({ pathname: "/ru/", languages: ["ru"] });
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
    assert.ok(
      html.indexOf('src="' + (file.includes("/") ? "../" : "") + 'init.js"') <
        html.indexOf('rel="stylesheet"'),
    );
    assert.match(html, /<script src="(?:\.\.\/)?init.js"><\/script>/);
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
      const resolved = path.resolve(
        path.dirname(file),
        url === "/" ? "../index.html" : url,
      );
      const target = url === "/" ? "index.html" : resolved;
      assert.ok(fs.existsSync(target), `${file}: ${url}`);
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
    en
      .slice(en.indexOf('<div class="hero">'), en.indexOf("<footer>"))
      .replace('href="experience.html"', 'href="en/experience.html"'),
  );
  const css = fs.readFileSync("style.css", "utf8");
  assert.match(css, /:root:not\(\[data-theme\]\)/);
  assert.doesNotMatch(css, /opacity:\s*0(?:;|\s)|visibility:\s*hidden/);
});
test("container has an explicit public asset allowlist and CI publishes only after checks", () => {
  const docker = fs.readFileSync("Dockerfile", "utf8");
  assert.match(docker, /FROM nginxinc\/nginx-unprivileged:1\.28\.0-alpine-slim/);
  assert.match(docker, /USER 101/);
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
