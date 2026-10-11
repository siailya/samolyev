import { createHmac } from "node:crypto";
import { setTimeout as sleep } from "node:timers/promises";
import { pathToFileURL } from "node:url";
import { isCurrentMain, request } from "./current-head.mjs";

export const siteURL = "https://samolyev.ru";
export const webhookBody = JSON.stringify({ ref: "refs/heads/main" });

// Sign the same UTF-8 bytes that fetch sends, without reserializing the body.
export function sign(body, secret) {
  return `sha256=${createHmac("sha256", secret).update(body, "utf8").digest("hex")}`;
}

export async function verifyRevision(
  sha,
  { fetchImpl = fetch, delay = sleep, log = console.log, attempts = 24 } = {},
) {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const health = await request(
        `${siteURL}/healthz`,
        { headers: { "Cache-Control": "no-cache" } },
        fetchImpl,
      );
      const healthBody = await health.text();
      const revision = await request(
        `${siteURL}/revision.txt`,
        { headers: { "Cache-Control": "no-cache" } },
        fetchImpl,
      );
      const revisionBody = await revision.text();
      if (
        health.ok &&
        revision.ok &&
        healthBody === "ok\n" &&
        revisionBody === `${sha}\n`
      ) {
        log("Public health and exact release revision verified");
        return;
      }
    } catch {
      // Only public GETs are retried, including transient network errors.
    }
    log(`Release verification pending (${attempt}/${attempts})`);
    if (attempt < attempts) await delay(5000);
  }
  throw new Error("Release verification failed: healthy exact revision was not served");
}

export async function deploy(
  env,
  { fetchImpl = fetch, delay = sleep, log = console.log, attempts = 24 } = {},
) {
  const webhookURL = env.KOMODO_WEBHOOK_URL;
  if (typeof webhookURL !== "string" || !webhookURL.trim()) {
    throw new Error("KOMODO_WEBHOOK_URL is required; no webhook sent");
  }
  try {
    const url = new URL(webhookURL);
    if (
      !/^https:\/\/[^/?#\\]+(?:[/?]|$)/i.test(webhookURL) ||
      /[\s\\#]/.test(webhookURL) ||
      /^https:\/\/[^/]*@/i.test(webhookURL) ||
      url.protocol !== "https:" ||
      !url.hostname ||
      url.username ||
      url.password
    ) {
      throw new Error();
    }
  } catch {
    throw new Error(
      "KOMODO_WEBHOOK_URL must be an absolute HTTPS URL without credentials or fragment; no webhook sent",
    );
  }
  if (!env.KOMODO_WEBHOOK_SECRET) {
    throw new Error("KOMODO_WEBHOOK_SECRET is required; no webhook sent");
  }
  if (!(await isCurrentMain(env, fetchImpl))) {
    log("Stale or non-main run skipped; no webhook sent");
    return false;
  }
  let response;
  try {
    response = await request(
      webhookURL,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-hub-signature-256": sign(webhookBody, env.KOMODO_WEBHOOK_SECRET),
        },
        body: webhookBody,
      },
      fetchImpl,
    );
  } catch {
    throw new Error(
      "Webhook request failed or timed out; acceptance unknown, not retried",
    );
  }
  if (!response.ok) throw new Error(`Webhook rejected: HTTP ${response.status}`);
  log(`Webhook accepted: HTTP ${response.status}; verifying public release`);
  await verifyRevision(env.GITHUB_SHA, { fetchImpl, delay, log, attempts });
  return true;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await deploy(process.env);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
