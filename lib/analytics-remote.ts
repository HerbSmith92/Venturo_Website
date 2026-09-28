import { createPrivateKey, sign } from "crypto";
import { gunzipSync } from "zlib";
import { johannesburgDay } from "@/lib/portal-home";
import { createServiceClient } from "@/lib/supabase/admin";

const STALE_MS = 6 * 60 * 60 * 1000;
const FETCH_MS = 20_000;

export type RemoteSource = "api" | "manual" | "none";

export type RevenueCatOverview = {
  activeSubscriptions: number | null;
  activeTrials: number | null;
  newCustomers28d: number | null;
  mrr: number | null;
  revenue28d: number | null;
  currency: string | null;
};

export type RemoteMetric = {
  value: number | null;
  today: number | null;
  source: RemoteSource;
  error: string | null;
  fetchedAt: string | null;
};

export type RemoteAnalytics = {
  ios: RemoteMetric;
  android: RemoteMetric;
  revenueCat: RevenueCatOverview & {
    source: RemoteSource;
    error: string | null;
    fetchedAt: string | null;
  };
};

type CacheRow = {
  key: string;
  payload: Record<string, unknown>;
  source: string;
  error: string | null;
  fetched_at: string;
};

function blankMetric(): RemoteMetric {
  return { value: null, today: null, source: "none", error: null, fetchedAt: null };
}

function blankRemote(): RemoteAnalytics {
  return {
    ios: blankMetric(),
    android: blankMetric(),
    revenueCat: {
      activeSubscriptions: null,
      activeTrials: null,
      newCustomers28d: null,
      mrr: null,
      revenue28d: null,
      currency: null,
      source: "none",
      error: null,
      fetchedAt: null,
    },
  };
}

function env(name: string) {
  return process.env[name]?.trim() || "";
}

function pemFromEnv(raw: string) {
  return raw.includes("BEGIN") ? raw.replace(/\\n/g, "\n") : raw;
}

function base64url(input: Buffer | string) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return buf.toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function signJwt(header: Record<string, unknown>, payload: Record<string, unknown>, pem: string, alg: "ES256" | "RS256") {
  const encoded = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;
  const key = createPrivateKey(pemFromEnv(pem));
  const signature =
    alg === "ES256"
      ? sign(null, Buffer.from(encoded), { key, dsaEncoding: "ieee-p1363" })
      : sign("RSA-SHA256", Buffer.from(encoded), key);
  return `${encoded}.${base64url(signature)}`;
}

async function timedFetch(url: string, init: RequestInit = {}) {
  return fetch(url, { ...init, cache: "no-store", signal: AbortSignal.timeout(FETCH_MS) });
}

export function iosApiConfigured() {
  return Boolean(
    env("APP_STORE_CONNECT_ISSUER_ID") &&
      env("APP_STORE_CONNECT_KEY_ID") &&
      env("APP_STORE_CONNECT_PRIVATE_KEY") &&
      env("APP_STORE_CONNECT_VENDOR_NUMBER"),
  );
}

export function androidApiConfigured() {
  return Boolean(
    env("GOOGLE_PLAY_PACKAGE_NAME") &&
      env("GOOGLE_PLAY_REPORTS_BUCKET") &&
      env("GOOGLE_PLAY_SERVICE_ACCOUNT_JSON"),
  );
}

export function revenueCatChartsConfigured() {
  return Boolean(env("REVENUECAT_SECRET_API_KEY") && env("REVENUECAT_PROJECT_ID"));
}

function parseTsv(text: string) {
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return [] as Record<string, string>[];
  const headers = lines[0].split("\t").map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cells = line.split("\t");
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = cells[index] ?? "";
    });
    return row;
  });
}

function numberFromRow(row: Record<string, string>, names: string[]) {
  const keys = Object.keys(row);
  for (const name of names) {
    const key = keys.find((item) => item.toLowerCase() === name.toLowerCase());
    if (!key) continue;
    const n = Number(String(row[key]).replace(/,/g, ""));
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

type DayCount = { day: string; downloads: number };

type DownloadPull = {
  total: number | null;
  today: number;
  days: DayCount[];
};

function monthStamp(delta = 0) {
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - delta, 1));
  return {
    yyyymm: `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}`,
    yearMonth: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`,
  };
}

function parseReportDay(raw: string) {
  const value = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const match = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!match) return null;
  const month = match[1].padStart(2, "0");
  const day = match[2].padStart(2, "0");
  const year = match[3].length === 2 ? `20${match[3]}` : match[3];
  return `${year}-${month}-${day}`;
}

function downloadFromRow(row: Record<string, string>) {
  return numberFromRow(row, [
    "First-Time Downloads",
    "First Time Downloads",
    "Daily User Installs",
    "Daily Device Installs",
    "Units",
    "Total Downloads",
  ]);
}

function mergeDays(rows: DayCount[]) {
  const map = new Map<string, number>();
  for (const row of rows) {
    if (!row.day) continue;
    map.set(row.day, (map.get(row.day) ?? 0) + row.downloads);
  }
  return [...map.entries()]
    .map(([day, downloads]) => ({ day, downloads }))
    .sort((a, b) => a.day.localeCompare(b.day));
}

async function saveDownloadDays(platform: "ios" | "android", days: DayCount[]) {
  const supabase = createServiceClient();
  if (!supabase || days.length === 0) return;
  const { error } = await supabase.from("store_download_days").upsert(
    days.map((row) => ({
      platform,
      day: row.day,
      downloads: row.downloads,
    })),
    { onConflict: "platform,day" },
  );
  if (error) console.error("[store_download_days]", platform, error.message);
}

async function appleReport(token: string, filters: Record<string, string>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    params.set(`filter[${key}]`, value);
  }
  const response = await timedFetch(
    `https://api.appstoreconnect.apple.com/v1/salesReports?${params.toString()}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`App Store Connect ${response.status}: ${body.slice(0, 180)}`);
  }
  const buf = Buffer.from(await response.arrayBuffer());
  try {
    return gunzipSync(buf).toString("utf8");
  } catch {
    return buf.toString("utf8");
  }
}

function appleToken() {
  const now = Math.floor(Date.now() / 1000);
  return signJwt(
    { alg: "ES256", kid: env("APP_STORE_CONNECT_KEY_ID"), typ: "JWT" },
    {
      iss: env("APP_STORE_CONNECT_ISSUER_ID"),
      iat: now,
      exp: now + 12 * 60,
      aud: "appstoreconnect-v1",
    },
    env("APP_STORE_CONNECT_PRIVATE_KEY"),
    "ES256",
  );
}

async function fetchIosLifetime(token: string, vendor: string) {
  let total = 0;
  let found = false;
  const year = new Date().getUTCFullYear();
  for (const reportYear of [year, year - 1]) {
    try {
      const text = await appleReport(token, {
        frequency: "YEARLY",
        reportDate: String(reportYear),
        reportSubType: "SUMMARY",
        reportType: "INSTALLS",
        vendorNumber: vendor,
        version: "1_0",
      });
      for (const row of parseTsv(text)) {
        total += numberFromRow(row, ["First-Time Downloads", "Units"]);
        found = true;
      }
    } catch {
      // Current-year summary can be empty until Apple closes the first window.
    }
  }
  return found ? total : null;
}

async function fetchIosDownloads(): Promise<DownloadPull> {
  if (!iosApiConfigured()) {
    return { total: null, today: 0, days: [] };
  }
  const token = appleToken();
  const vendor = env("APP_STORE_CONNECT_VENDOR_NUMBER");
  const days: DayCount[] = [];
  let lastError = "No iOS install report.";
  for (const delta of [0, 1]) {
    const { yearMonth } = monthStamp(delta);
    try {
      const text = await appleReport(token, {
        frequency: "MONTHLY",
        reportDate: yearMonth,
        reportSubType: "DETAILED",
        reportType: "INSTALLS",
        vendorNumber: vendor,
        version: "1_2",
      });
      for (const row of parseTsv(text)) {
        const day = parseReportDay(row.Date ?? row.date ?? "");
        if (!day) continue;
        days.push({ day, downloads: downloadFromRow(row) });
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : "iOS pull failed.";
    }
  }
  const merged = mergeDays(days);
  if (!merged.length) throw new Error(lastError);
  const today = johannesburgDay();
  const todayCount = merged.find((row) => row.day === today)?.downloads ?? 0;
  const lifetime = await fetchIosLifetime(token, vendor);
  await saveDownloadDays("ios", merged);
  return {
    total: lifetime ?? merged.reduce((sum, row) => sum + row.downloads, 0),
    today: todayCount,
    days: merged,
  };
}

function decodePlayCsv(buf: Buffer) {
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) {
    return buf.subarray(2).toString("utf16le");
  }
  return buf.toString("utf8");
}

function parseCsv(text: string) {
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return [] as Record<string, string>[];
  const headers = lines[0].split(",").map((h) => h.replace(/^\uFEFF/, "").trim());
  return lines.slice(1).map((line) => {
    const cells = line.split(",");
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = (cells[index] ?? "").trim();
    });
    return row;
  });
}

async function googleAccessToken() {
  const raw = env("GOOGLE_PLAY_SERVICE_ACCOUNT_JSON");
  const account = JSON.parse(raw) as { client_email?: string; private_key?: string };
  if (!account.client_email || !account.private_key) {
    throw new Error("GOOGLE_PLAY_SERVICE_ACCOUNT_JSON needs client_email & private_key.");
  }
  const now = Math.floor(Date.now() / 1000);
  const jwt = signJwt(
    { alg: "RS256", typ: "JWT" },
    {
      iss: account.client_email,
      scope: "https://www.googleapis.com/auth/devstorage.read_only",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 50 * 60,
    },
    account.private_key,
    "RS256",
  );
  const response = await timedFetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  const payload = (await response.json()) as { access_token?: string; error?: string };
  if (!response.ok || !payload.access_token) {
    throw new Error(payload.error ?? `Google auth ${response.status}`);
  }
  return payload.access_token;
}

async function fetchAndroidDownloads(): Promise<DownloadPull> {
  if (!androidApiConfigured()) {
    return { total: null, today: 0, days: [] };
  }
  const token = await googleAccessToken();
  const bucket = env("GOOGLE_PLAY_REPORTS_BUCKET").replace(/^gs:\/\//, "");
  const pkg = env("GOOGLE_PLAY_PACKAGE_NAME");
  const days: DayCount[] = [];
  let total: number | null = null;
  let lastError = "Play report not found.";
  for (const delta of [0, 1]) {
    const { yyyymm } = monthStamp(delta);
    const object = `stats/installs/installs_${pkg}_${yyyymm}_overview.csv`;
    const url = `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(bucket)}/o/${encodeURIComponent(object)}?alt=media`;
    const response = await timedFetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) {
      lastError = `Play Console ${response.status} (${object})`;
      continue;
    }
    const rows = parseCsv(decodePlayCsv(Buffer.from(await response.arrayBuffer())));
    for (const row of rows) {
      const day = parseReportDay(row.Date ?? row.date ?? "");
      if (!day) continue;
      days.push({ day, downloads: numberFromRow(row, ["Daily User Installs", "Daily Device Installs"]) });
      const lifetime = numberFromRow(row, ["Total User Installs", "Current User Installs"]);
      if (lifetime > (total ?? 0)) total = lifetime;
    }
  }
  const merged = mergeDays(days);
  if (!merged.length) throw new Error(lastError);
  const today = johannesburgDay();
  const todayCount = merged.find((row) => row.day === today)?.downloads ?? 0;
  await saveDownloadDays("android", merged);
  return { total: total ?? merged.reduce((sum, row) => sum + row.downloads, 0), today: todayCount, days: merged };
}

function metricValue(
  metrics: { id?: string; value?: number }[] | undefined,
  ids: string[],
) {
  const hit = metrics?.find((item) => item.id && ids.includes(item.id));
  const n = Number(hit?.value);
  return Number.isFinite(n) ? n : null;
}

async function fetchRevenueCat(): Promise<RemoteAnalytics["revenueCat"]> {
  if (!revenueCatChartsConfigured()) {
    return { ...blankRemote().revenueCat, error: null };
  }
  const project = env("REVENUECAT_PROJECT_ID");
  const secret = env("REVENUECAT_SECRET_API_KEY");
  const headers = { Authorization: `Bearer ${secret}` };
  const today = johannesburgDay();
  const start = new Date(`${today}T00:00:00+02:00`);
  start.setUTCDate(start.getUTCDate() - 27);
  const startDate = start.toISOString().slice(0, 10);

  const overviewUrl = `https://api.revenuecat.com/v2/projects/${encodeURIComponent(project)}/metrics/overview?currency=USD`;
  const customersUrl = `https://api.revenuecat.com/v2/projects/${encodeURIComponent(project)}/charts/customers_new?start_date=${startDate}&end_date=${today}&aggregate=total`;
  const revenueUrl = `https://api.revenuecat.com/v2/projects/${encodeURIComponent(project)}/metrics/revenue?start_date=${startDate}&end_date=${today}&currency=USD&revenue_type=proceeds`;

  const [overviewRes, customersRes, revenueRes] = await Promise.all([
    timedFetch(overviewUrl, { headers }),
    timedFetch(customersUrl, { headers }),
    timedFetch(revenueUrl, { headers }),
  ]);

  if (!overviewRes.ok) {
    const body = await overviewRes.text();
    throw new Error(`RevenueCat ${overviewRes.status}: ${body.slice(0, 180)}`);
  }
  const overview = (await overviewRes.json()) as {
    currency?: string;
    metrics?: { id?: string; value?: number }[];
  };
  let newCustomers28d: number | null = null;
  if (customersRes.ok) {
    const chart = (await customersRes.json()) as { summary?: { total?: number } };
    const n = Number(chart.summary?.total);
    newCustomers28d = Number.isFinite(n) ? n : null;
  }
  let revenue28d: number | null = null;
  if (revenueRes.ok) {
    const revenue = (await revenueRes.json()) as { value?: number };
    const n = Number(revenue.value);
    revenue28d = Number.isFinite(n) ? n : null;
  }

  return {
    activeSubscriptions: metricValue(overview.metrics, ["active_subscriptions", "actives", "active_subscribers"]),
    activeTrials: metricValue(overview.metrics, ["active_trials", "trials"]),
    newCustomers28d,
    mrr: metricValue(overview.metrics, ["mrr"]),
    revenue28d,
    currency: overview.currency ?? "USD",
    source: "api",
    error: null,
    fetchedAt: new Date().toISOString(),
  };
}

async function readCache(): Promise<CacheRow[]> {
  const supabase = createServiceClient();
  if (!supabase) return [];
  const { data } = await supabase.from("analytics_remote_cache").select("key, payload, source, error, fetched_at");
  return (data ?? []) as CacheRow[];
}

async function writeCache(key: string, payload: Record<string, unknown>, source: RemoteSource, error: string | null) {
  const supabase = createServiceClient();
  if (!supabase) return;
  await supabase.from("analytics_remote_cache").upsert({
    key,
    payload,
    source,
    error,
    fetched_at: new Date().toISOString(),
  });
}

function rowToMetric(row: CacheRow | undefined): RemoteMetric {
  if (!row) return blankMetric();
  const value = Number(row.payload.value);
  const todayRaw = row.payload.today;
  const today = Number(todayRaw);
  return {
    value: Number.isFinite(value) ? value : null,
    today: todayRaw === null || todayRaw === undefined || !Number.isFinite(today) ? null : today,
    source: (row.source as RemoteSource) || "none",
    error: row.error,
    fetchedAt: row.fetched_at,
  };
}

function cacheIsFresh(iso: string | null | undefined) {
  if (!iso) return false;
  return Date.now() - new Date(iso).getTime() < STALE_MS;
}

export async function refreshRemoteAnalytics(force = false): Promise<RemoteAnalytics> {
  const existing = await loadRemoteAnalyticsFromCache();
  const jobs: Promise<void>[] = [];

  if (force || (!cacheIsFresh(existing.ios.fetchedAt) && iosApiConfigured())) {
    jobs.push(
      fetchIosDownloads()
        .then((pull) => writeCache("ios", { value: pull.total, today: pull.today }, "api", null))
        .catch((error) =>
          writeCache("ios", { value: existing.ios.value, today: existing.ios.today }, existing.ios.source, error instanceof Error ? error.message : "iOS pull failed."),
        ),
    );
  }
  if (force || (!cacheIsFresh(existing.android.fetchedAt) && androidApiConfigured())) {
    jobs.push(
      fetchAndroidDownloads()
        .then((pull) => writeCache("android", { value: pull.total, today: pull.today }, "api", null))
        .catch((error) =>
          writeCache(
            "android",
            { value: existing.android.value, today: existing.android.today },
            existing.android.source,
            error instanceof Error ? error.message : "Android pull failed.",
          ),
        ),
    );
  }
  if (force || (!cacheIsFresh(existing.revenueCat.fetchedAt) && revenueCatChartsConfigured())) {
    jobs.push(
      fetchRevenueCat()
        .then((metric) =>
          writeCache(
            "revenuecat",
            {
              activeSubscriptions: metric.activeSubscriptions,
              activeTrials: metric.activeTrials,
              newCustomers28d: metric.newCustomers28d,
              mrr: metric.mrr,
              revenue28d: metric.revenue28d,
              currency: metric.currency,
            },
            "api",
            null,
          ),
        )
        .catch((error) =>
          writeCache(
            "revenuecat",
            {
              activeSubscriptions: existing.revenueCat.activeSubscriptions,
              activeTrials: existing.revenueCat.activeTrials,
              newCustomers28d: existing.revenueCat.newCustomers28d,
              mrr: existing.revenueCat.mrr,
              revenue28d: existing.revenueCat.revenue28d,
              currency: existing.revenueCat.currency,
            },
            existing.revenueCat.source,
            error instanceof Error ? error.message : "RevenueCat pull failed.",
          ),
        ),
    );
  }

  if (jobs.length) await Promise.all(jobs);
  return loadRemoteAnalyticsFromCache();
}

export async function loadRemoteAnalyticsFromCache(): Promise<RemoteAnalytics> {
  const rows = await readCache();
  const byKey = new Map(rows.map((row) => [row.key, row]));
  const ios = rowToMetric(byKey.get("ios"));
  const android = rowToMetric(byKey.get("android"));
  const rc = byKey.get("revenuecat");
  const payload = (rc?.payload ?? {}) as RevenueCatOverview;
  return {
    ios,
    android,
    revenueCat: {
      activeSubscriptions: Number.isFinite(Number(payload.activeSubscriptions)) ? Number(payload.activeSubscriptions) : null,
      activeTrials: Number.isFinite(Number(payload.activeTrials)) ? Number(payload.activeTrials) : null,
      newCustomers28d: Number.isFinite(Number(payload.newCustomers28d)) ? Number(payload.newCustomers28d) : null,
      mrr: Number.isFinite(Number(payload.mrr)) ? Number(payload.mrr) : null,
      revenue28d: Number.isFinite(Number(payload.revenue28d)) ? Number(payload.revenue28d) : null,
      currency: typeof payload.currency === "string" ? payload.currency : null,
      source: (rc?.source as RemoteSource) || "none",
      error: rc?.error ?? null,
      fetchedAt: rc?.fetched_at ?? null,
    },
  };
}

export async function saveManualDownloads(ios: number, android: number) {
  await Promise.all([
    writeCache("ios", { value: ios, today: null }, "manual", null),
    writeCache("android", { value: android, today: null }, "manual", null),
  ]);
}
