import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { isCurrentMain, writeHeadOutput } from "../scripts/current-head.mjs";
import { deploy, sign, webhookBody } from "../scripts/komodo-deploy.mjs";

// All network calls in this suite are explicit unit mocks, never a real deploy.
const sha = "a".repeat(40);
const env = {
  GITHUB_REF: "refs/heads/main",
  GITHUB_EVENT_NAME: "push",
  GITHUB_REPOSITORY: "siailya/samolyev",
  GITHUB_SHA: sha,
  GITHUB_TOKEN: "dummy-ephemeral-token",
  KOMODO_WEBHOOK_SECRET: "dummy-webhook-secret",
  KOMODO_WEBHOOK_URL: "https://deploy.example.test/hook",
};
const head = (revision = sha) => Response.json({ object: { sha: revision } });
const noNetwork = async () => assert.fail("Unexpected network request");
const options = (fetchImpl) => ({
  fetchImpl,
  delay: async () => {},
  log: () => {},
  attempts: 2,
});

test("sign uses the standard HMAC SHA256 vector and exact UTF-8 bytes", () => {
  assert.equal(
    sign("The quick brown fox jumps over the lazy dog", "key"),
    "sha256=f7bc83f430538424b13298e6aa6fb143ef4d59a14946175997479dbc2d1a3cd8",
  );
  assert.notEqual(sign(webhookBody, "dummy"), sign(`${webhookBody}\n`, "dummy"));
  assert.notEqual(sign("é", "dummy"), sign("e", "dummy"));
});

test("missing secret fails before any request", async () => {
  await assert.rejects(
    deploy({ ...env, KOMODO_WEBHOOK_SECRET: "" }, options(noNetwork)),
    /KOMODO_WEBHOOK_SECRET is required/,
  );
});

test("missing webhook URL fails before any request", async () => {
  for (const url of [undefined, "", "   "]) {
    await assert.rejects(
      deploy({ ...env, KOMODO_WEBHOOK_URL: url }, options(noNetwork)),
      /KOMODO_WEBHOOK_URL is required/,
    );
  }
});

test("invalid webhook URLs fail before any request without exposing their value", async () => {
  for (const url of [
    "not-a-url",
    "/hook",
    "https://",
    "https:deploy.example.test/hook",
    "https:///deploy.example.test/hook",
    "http://deploy.example.test/hook",
    "https://user:password@deploy.example.test/hook",
    "https://user@deploy.example.test/hook",
    "https://:password@deploy.example.test/hook",
    "https://@deploy.example.test/hook",
    "https://deploy.example.test/hook#fragment",
    "https://deploy.example.test/hook#",
    "https://deploy.example.test/ho\\ok",
    " https://deploy.example.test/hook",
  ]) {
    const logs = [];
    await assert.rejects(
      deploy(
        { ...env, KOMODO_WEBHOOK_URL: url },
        { ...options(noNetwork), log: (line) => logs.push(line) },
      ),
      (error) => {
        assert.match(error.message, /must be an absolute HTTPS URL/);
        assert.ok(!error.message.includes(url));
        return true;
      },
    );
    assert.deepEqual(logs, []);
  }
});

test("non-main dispatch and PR cannot publish or deploy", async () => {
  for (const change of [
    { GITHUB_REF: "refs/heads/feature", GITHUB_EVENT_NAME: "workflow_dispatch" },
    { GITHUB_EVENT_NAME: "pull_request" },
  ]) {
    assert.equal(await isCurrentMain({ ...env, ...change }, noNetwork), false);
    assert.equal(await deploy({ ...env, ...change }, options(noNetwork)), false);
  }
});

test("stale main writes false for publication and never sends a webhook", async () => {
  const directory = await mkdtemp(join(tmpdir(), "site-head-test-"));
  try {
    const output = join(directory, "output");
    const stale = async () => head("b".repeat(40));
    assert.equal(await writeHeadOutput({ ...env, GITHUB_OUTPUT: output }, stale), false);
    assert.equal(await readFile(output, "utf8"), "current=false\n");
    let calls = 0;
    assert.equal(
      await deploy(
        env,
        options(async (url) => {
          calls++;
          assert.match(
            url,
            /api.github.com\/repos\/siailya\/samolyev\/git\/ref\/heads\/main$/,
          );
          return head("b".repeat(40));
        }),
      ),
      false,
    );
    assert.equal(calls, 1);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("head API failures fail closed", async () => {
  for (const response of [new Response("", { status: 403 }), Response.json({})]) {
    await assert.rejects(
      deploy(
        env,
        options(async () => response),
      ),
      /Head guard/,
    );
  }
});

test("webhook rejection and ambiguous timeout fail without retries or leaking details", async () => {
  for (const status of [401, 500, "timeout"]) {
    let posts = 0;
    await assert.rejects(
      deploy(
        env,
        options(async (url) => {
          if (url.includes("api.github.com")) return head();
          assert.equal(url, env.KOMODO_WEBHOOK_URL);
          posts++;
          if (status === "timeout") {
            throw new Error(
              `${env.KOMODO_WEBHOOK_URL} ${env.KOMODO_WEBHOOK_SECRET} ${sign(webhookBody, env.KOMODO_WEBHOOK_SECRET)}`,
            );
          }
          return new Response("sensitive response details", { status });
        }),
      ),
      (error) => {
        assert.match(
          error.message,
          status === "timeout"
            ? /acceptance unknown, not retried/
            : /Webhook rejected: HTTP/,
        );
        assert.ok(!error.message.includes(env.KOMODO_WEBHOOK_URL));
        assert.ok(!error.message.includes(env.KOMODO_WEBHOOK_SECRET));
        assert.doesNotMatch(error.message, /sha256=|sensitive/);
        return true;
      },
    );
    assert.equal(posts, 1);
  }
});

test("HTTP acceptance and healthy stale revision never count as success", async () => {
  let posts = 0;
  let gets = 0;
  await assert.rejects(
    deploy(
      env,
      options(async (url) => {
        if (url.includes("api.github.com")) return head();
        if (url === env.KOMODO_WEBHOOK_URL) {
          posts++;
          return new Response("accepted");
        }
        gets++;
        return new Response(url.endsWith("healthz") ? "ok\n" : `${"b".repeat(40)}\n`);
      }),
    ),
    /Release verification failed/,
  );
  assert.equal(posts, 1);
  assert.equal(gets, 4);
});

test("exact revision also requires successful public health and revision responses", async () => {
  for (const failedPath of ["healthz", "revision.txt"]) {
    await assert.rejects(
      deploy(
        env,
        options(async (url) => {
          if (url.includes("api.github.com")) return head();
          if (url === env.KOMODO_WEBHOOK_URL) return new Response("accepted");
          return new Response(url.endsWith("healthz") ? "ok\n" : `${sha}\n`, {
            status: url.endsWith(failedPath) ? 503 : 200,
          });
        }),
      ),
      /Release verification failed/,
    );
  }
});

test("signed POST followed by transient GET failure and exact revision succeeds", async () => {
  const logs = [];
  let posts = 0;
  let healthChecks = 0;
  assert.equal(
    await deploy(env, {
      ...options(async (url, request) => {
        assert.equal(request.redirect, "error");
        assert.ok(request.signal instanceof AbortSignal);
        if (url.includes("api.github.com")) {
          assert.equal(request.headers.Authorization, `Bearer ${env.GITHUB_TOKEN}`);
          return head();
        }
        assert.equal(request.headers.Authorization, undefined);
        if (url === env.KOMODO_WEBHOOK_URL) {
          posts++;
          assert.equal(request.method, "POST");
          assert.equal(request.body, '{"ref":"refs/heads/main"}');
          assert.equal(request.headers["Content-Type"], "application/json");
          assert.equal(
            request.headers["x-hub-signature-256"],
            sign(request.body, env.KOMODO_WEBHOOK_SECRET),
          );
          return new Response("accepted");
        }
        if (url.endsWith("healthz") && ++healthChecks === 1) throw new Error("offline");
        return new Response(url.endsWith("healthz") ? "ok\n" : `${sha}\n`);
      }),
      log: (line) => logs.push(line),
    }),
    true,
  );
  assert.equal(posts, 1);
  assert.equal(healthChecks, 2);
  assert.match(logs.at(-1), /exact release revision verified/);
  assert.doesNotMatch(logs.join("\n"), /dummy|sha256=|accepted"/);
  assert.ok(!logs.join("\n").includes(env.KOMODO_WEBHOOK_URL));
});

test("webhook accepts an arbitrary HTTPS host, port, path and query from env", async () => {
  const customEnv = {
    ...env,
    KOMODO_WEBHOOK_URL: "https://other.example.test:8443/custom/deploy?target=site",
  };
  let posts = 0;
  assert.equal(
    await deploy(
      customEnv,
      options(async (url, request) => {
        if (url.includes("api.github.com")) return head();
        if (request.method === "POST") {
          assert.equal(url, customEnv.KOMODO_WEBHOOK_URL);
          posts++;
          return new Response("accepted");
        }
        return new Response(url.endsWith("healthz") ? "ok\n" : `${sha}\n`);
      }),
    ),
    true,
  );
  assert.equal(posts, 1);
});

test("workflow serializes the full run and gates publication and deployment", async () => {
  const workflow = await readFile(".github/workflows/site.yml", "utf8");
  assert.match(
    workflow,
    /concurrency:\n  group: site-\$\{\{ github.ref \}\}\n  cancel-in-progress: false\njobs:/,
  );
  assert.match(
    workflow,
    /if: github.event_name != 'pull_request' && github.ref == 'refs\/heads\/main'/,
  );
  assert.match(workflow, /run: node scripts\/current-head.mjs/);
  assert.equal(
    (workflow.match(/if: steps.head.outputs.current == 'true'/g) ?? []).length,
    3,
  );
  assert.match(
    workflow,
    /published:.*steps.head.outputs.current == 'true'.*steps.image.outcome == 'success'/,
  );
  assert.match(workflow, /needs.publish.outputs.published == 'true'\n    needs: publish/);
  assert.match(workflow, /run: node scripts\/komodo-deploy.mjs/);
  assert.equal(
    (workflow.match(/build-args: SITE_REVISION=\$\{\{ github.sha \}\}/g) ?? []).length,
    2,
  );
  assert.equal((workflow.match(/secrets.KOMODO_WEBHOOK_SECRET/g) ?? []).length, 1);
  assert.match(
    workflow,
    /KOMODO_WEBHOOK_SECRET: \$\{\{ secrets.KOMODO_WEBHOOK_SECRET \}\}\n          KOMODO_WEBHOOK_URL: \$\{\{ secrets.KOMODO_WEBHOOK_URL \}\}/,
  );
});
