export function AnalyticsKeysGuide({ className = "cr-paper" }: { className?: string }) {
  return (
    <article className={className} style={{ marginTop: 28 }}>
      <p className="eyebrow">Keys</p>
      <h2>Create The Analytics Keys</h2>
      <p className="muted">
        You create these in Apple, Google, RevenueCat, then paste them into
        Vercel → venturo-website → Settings → Environment Variables →
        Production. After save, redeploy Production so Analytics can pull.
      </p>

      <h3 style={{ marginTop: 24 }}>1. RevenueCat</h3>
      <p className="muted">Subscribers, trials, MRR. Not store downloads.</p>
      <ol className="muted" style={{ paddingLeft: 20 }}>
        <li>
          Open{" "}
          <a href="https://app.revenuecat.com" target="_blank" rel="noreferrer">
            app.revenuecat.com
          </a>{" "}
          → the Venturo project.
        </li>
        <li>
          Project settings → look for <strong>Project ID</strong> (
          <code>proj_…</code>). That is <code>REVENUECAT_PROJECT_ID</code>.
        </li>
        <li>
          API keys → create a new <strong>Secret API key</strong> (API v2). The
          old public/legacy SDK key will 403. Permissions:{" "}
          <code>charts_metrics:overview:read</code> &{" "}
          <code>charts_metrics:charts:read</code>. That is{" "}
          <code>REVENUECAT_SECRET_API_KEY</code>. Keep the existing webhook
          secret as <code>REVENUECAT_WEBHOOK_AUTH</code>.
        </li>
      </ol>

      <h3 style={{ marginTop: 24 }}>2. iOS — App Store Connect</h3>
      <p className="muted">Daily first-time downloads. Must be a Team key, not Individual.</p>
      <ol className="muted" style={{ paddingLeft: 20 }}>
        <li>
          Open{" "}
          <a
            href="https://appstoreconnect.apple.com/access/integrations/api"
            target="_blank"
            rel="noreferrer"
          >
            App Store Connect → Users and Access → Integrations → App Store Connect API
          </a>
          .
        </li>
        <li>
          Select <strong>Team Keys</strong>. Generate a key named Venturo Analytics.
          Role: <strong>Finance</strong> or Admin (Sales reports need finance
          access). Download the <code>.p8</code> once.
        </li>
        <li>
          Copy <strong>Issuer ID</strong> at the top →{" "}
          <code>APP_STORE_CONNECT_ISSUER_ID</code>.
        </li>
        <li>
          Copy the key’s <strong>Key ID</strong> → <code>APP_STORE_CONNECT_KEY_ID</code>.
        </li>
        <li>
          Open the <code>.p8</code> in a text editor. Paste the full block,
          including BEGIN/END, into <code>APP_STORE_CONNECT_PRIVATE_KEY</code>.
          If Vercel flattens it, replace each line break with <code>\n</code>.
        </li>
        <li>
          Vendor number: App Store Connect →{" "}
          <strong>Payments and Financial Reports</strong>. Top left. Digits only.
          That is <code>APP_STORE_CONNECT_VENDOR_NUMBER</code>.
        </li>
      </ol>

      <h3 style={{ marginTop: 24 }}>3. Android — Play Console</h3>
      <p className="muted">Daily user installs from the Download reports bucket.</p>
      <ol className="muted" style={{ paddingLeft: 20 }}>
        <li>
          Google Cloud → create or pick a project → APIs → enable{" "}
          <strong>Cloud Storage JSON API</strong>.
        </li>
        <li>
          IAM → Service accounts → Create. Name: venturo-play-reports. Create a
          JSON key. That whole JSON is <code>GOOGLE_PLAY_SERVICE_ACCOUNT_JSON</code>.
        </li>
        <li>
          Copy the service account email (ends in{" "}
          <code>.iam.gserviceaccount.com</code>).
        </li>
        <li>
          Open{" "}
          <a href="https://play.google.com/console" target="_blank" rel="noreferrer">
            Play Console
          </a>{" "}
          → Users and permissions → Invite user. Paste that email. App access:
          Venturo. Permissions: <strong>View app information and download bulk
          reports</strong>.
        </li>
        <li>
          Play Console → Download reports → <strong>Copy Cloud Storage URI</strong>.
          Looks like <code>pubsite_prod_rev_…</code>. That is{" "}
          <code>GOOGLE_PLAY_REPORTS_BUCKET</code> (no <code>gs://</code>).
        </li>
        <li>
          App package name (e.g. <code>za.co.venturo.app</code>) →{" "}
          <code>GOOGLE_PLAY_PACKAGE_NAME</code>.
        </li>
      </ol>

      <h3 style={{ marginTop: 24 }}>4. Paste On Vercel</h3>
      <p className="muted">
        Vercel → venturo-website → Settings → Environment Variables. Environment:
        Production. Then Deployments → … on the latest Production deploy → Redeploy.
      </p>
      <pre
        className="muted"
        style={{
          whiteSpace: "pre-wrap",
          marginTop: 12,
          padding: 16,
          borderRadius: 12,
          background: "color-mix(in srgb, var(--night) 70%, black)",
        }}
      >
        {`REVENUECAT_PROJECT_ID
REVENUECAT_SECRET_API_KEY
APP_STORE_CONNECT_ISSUER_ID
APP_STORE_CONNECT_KEY_ID
APP_STORE_CONNECT_PRIVATE_KEY
APP_STORE_CONNECT_VENDOR_NUMBER
GOOGLE_PLAY_PACKAGE_NAME
GOOGLE_PLAY_REPORTS_BUCKET
GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`}
      </pre>
    </article>
  );
}
