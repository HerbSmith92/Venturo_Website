import "server-only";
import { createSign } from "node:crypto";
import http2 from "node:http2";

export type NativePushDevice = {
  id: string;
  token: string;
  platform: string;
  apns_environment: string | null;
};

export type NativePushMessage = {
  title: string;
  body: string;
  path: string | null;
  kind: string;
  id: string;
  slug: string;
  when: string;
  campaignId: string;
};

type SendOutcome = {
  ok: boolean;
  drop: boolean;
  error: string | null;
};

const APPLE_BUNDLE = process.env.APNS_BUNDLE_ID?.trim() || "com.app.venturo";

export function nativePushKeysReady() {
  return {
    apple: Boolean(
      process.env.APNS_KEY_ID?.trim() &&
        process.env.APNS_TEAM_ID?.trim() &&
        process.env.APNS_PRIVATE_KEY?.trim(),
    ),
    android: Boolean(process.env.FIREBASE_SERVICE_ACCOUNT?.trim()),
  };
}

let appleJwt: { token: string; exp: number } | null = null;
let googleAccess: { token: string; project: string; exp: number } | null = null;

export async function deliverNativePush(devices: NativePushDevice[], message: NativePushMessage) {
  let pushed = 0;
  let failed = 0;
  const dropTokenIds: string[] = [];
  let error: string | null = null;

  const outcomes = await mapPool(devices, 20, (device) => deliverOne(device, message));
  for (const outcome of outcomes) {
    if (outcome.ok) {
      pushed += 1;
      continue;
    }
    failed += 1;
    error = error ?? outcome.error;
    if (outcome.drop) dropTokenIds.push(outcome.id);
  }

  return { pushed, failed, dropTokenIds, error };
}

async function deliverOne(device: NativePushDevice, message: NativePushMessage): Promise<SendOutcome & { id: string }> {
  if (device.platform === "ios") {
    const result = await sendApple(device, message);
    return { ...result, id: device.id };
  }
  if (device.platform === "android") {
    const result = await sendFirebase(device, message);
    return { ...result, id: device.id };
  }
  return { id: device.id, ok: false, drop: false, error: "That phone platform cannot receive a push." };
}

async function sendApple(device: NativePushDevice, message: NativePushMessage): Promise<SendOutcome> {
  const jwt = appleProviderToken();
  if (!jwt) {
    return { ok: false, drop: false, error: "The Apple push key is missing or could not be read." };
  }

  const host = device.apns_environment === "production"
    ? "https://api.push.apple.com"
    : "https://api.sandbox.push.apple.com";
  const body = JSON.stringify({
    aps: {
      alert: { title: message.title, body: message.body },
      sound: "default",
    },
    path: message.path ?? "",
    kind: message.kind,
    id: message.id,
    slug: message.slug,
    when: message.when,
    campaignId: message.campaignId,
  });

  const response = await postApple(host, device.token, jwt, body);
  if (response.status === 200) return { ok: true, drop: false, error: null };
  const drop = response.status === 410 || response.reason === "BadDeviceToken" || response.reason === "Unregistered";
  return {
    ok: false,
    drop,
    error: response.reason || (response.status ? `Apple push returned ${response.status}.` : "Apple push did not respond."),
  };
}

function appleProviderToken() {
  const keyId = process.env.APNS_KEY_ID?.trim();
  const teamId = process.env.APNS_TEAM_ID?.trim();
  const raw = process.env.APNS_PRIVATE_KEY?.trim();
  if (!keyId || !teamId || !raw) return null;
  const now = Math.floor(Date.now() / 1000);
  if (appleJwt && appleJwt.exp > now + 60) return appleJwt.token;

  try {
    const header = base64url(JSON.stringify({ alg: "ES256", kid: keyId }));
    const claims = base64url(JSON.stringify({ iss: teamId, iat: now }));
    const unsigned = `${header}.${claims}`;
    const signature = createSign("SHA256").update(unsigned).sign({
      key: raw.replace(/\\n/g, "\n"),
      dsaEncoding: "ieee-p1363",
    });
    const token = `${unsigned}.${base64url(signature)}`;
    appleJwt = { token, exp: now + 50 * 60 };
    return token;
  } catch {
    return null;
  }
}

function postApple(host: string, token: string, jwt: string, body: string) {
  return new Promise<{ status: number; reason: string | null }>((resolve) => {
    let settled = false;
    const client = http2.connect(host);
    const timer = setTimeout(() => finish(0, "Apple push did not respond."), 12_000);
    function finish(status: number, reason: string | null) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      client.close();
      resolve({ status, reason });
    }

    client.on("error", () => finish(0, "Apple push did not respond."));
    const request = client.request({
      ":method": "POST",
      ":path": `/3/device/${encodeURIComponent(token)}`,
      authorization: `bearer ${jwt}`,
      "apns-topic": APPLE_BUNDLE,
      "apns-push-type": "alert",
      "apns-priority": "10",
      "content-type": "application/json",
    });
    let raw = "";
    request.setEncoding("utf8");
    request.on("response", (headers) => {
      const status = Number(headers[":status"] ?? 0);
      request.on("data", (chunk) => {
        raw += chunk;
      });
      request.on("end", () => {
        let reason: string | null = null;
        if (raw) {
          try {
            reason = (JSON.parse(raw) as { reason?: string }).reason ?? null;
          } catch {
            reason = null;
          }
        }
        finish(status, reason);
      });
    });
    request.on("error", () => finish(0, "Apple push did not respond."));
    request.end(body);
  });
}

async function sendFirebase(device: NativePushDevice, message: NativePushMessage): Promise<SendOutcome> {
  const access = await firebaseAccess();
  if (!access) {
    return { ok: false, drop: false, error: "The Firebase account is not set on the server." };
  }

  let response: Response;
  try {
    response = await fetch(`https://fcm.googleapis.com/v1/projects/${access.project}/messages:send`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${access.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: {
          token: device.token,
          notification: { title: message.title, body: message.body },
          data: {
            path: message.path ?? "",
            kind: message.kind,
            id: message.id,
            slug: message.slug,
            when: message.when,
            campaignId: message.campaignId,
          },
          android: { priority: "HIGH" },
        },
      }),
    });
  } catch {
    return { ok: false, drop: false, error: "Firebase push did not respond." };
  }

  if (response.ok) return { ok: true, drop: false, error: null };
  const payload = (await response.json().catch(() => null)) as {
    error?: { message?: string; status?: string; details?: Array<{ errorCode?: string }> };
  } | null;
  const code = payload?.error?.details?.find((detail) => detail.errorCode)?.errorCode ?? payload?.error?.status;
  const drop =
    code === "UNREGISTERED" ||
    code === "NOT_FOUND" ||
    code === "INVALID_ARGUMENT" ||
    /UNREGISTERED|NOT_FOUND/i.test(payload?.error?.message ?? "");
  return {
    ok: false,
    drop,
    error: payload?.error?.message || `Firebase push returned ${response.status}.`,
  };
}

async function firebaseAccess() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT?.trim();
  if (!raw) return null;
  const now = Math.floor(Date.now() / 1000);
  if (googleAccess && googleAccess.exp > now + 60) return googleAccess;

  let account: { client_email?: string; private_key?: string; project_id?: string };
  try {
    account = JSON.parse(raw) as { client_email?: string; private_key?: string; project_id?: string };
  } catch {
    return null;
  }
  if (!account.client_email || !account.private_key || !account.project_id) return null;

  try {
    const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
    const claims = base64url(
      JSON.stringify({
        iss: account.client_email,
        scope: "https://www.googleapis.com/auth/firebase.messaging",
        aud: "https://oauth2.googleapis.com/token",
        iat: now,
        exp: now + 3600,
      }),
    );
    const unsigned = `${header}.${claims}`;
    const signature = createSign("RSA-SHA256").update(unsigned).sign(account.private_key.replace(/\\n/g, "\n"));
    const assertion = `${unsigned}.${base64url(signature)}`;
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion,
      }),
    });
    const payload = (await response.json().catch(() => null)) as { access_token?: string } | null;
    if (!response.ok || !payload?.access_token) return null;
    googleAccess = { token: payload.access_token, project: account.project_id, exp: now + 50 * 60 };
    return googleAccess;
  } catch {
    return null;
  }
}

function base64url(value: string | Buffer) {
  const buffer = typeof value === "string" ? Buffer.from(value) : value;
  return buffer.toString("base64url");
}

async function mapPool<T, R>(items: T[], size: number, run: (item: T) => Promise<R>) {
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(size, items.length) }, async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await run(items[index]);
    }
  });
  await Promise.all(workers);
  return results;
}
