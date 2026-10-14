import { getAppStoreLinks } from "@/lib/brand";
import { headers } from "next/headers";

const APP_STORE = "https://apps.apple.com/za/app/venturo-app/id6755754211";

export const metadata = {
  title: "Get the App · Venturo",
};

export default async function GetTheAppPage() {
  const ua = (await headers()).get("user-agent") ?? "";
  const stores = getAppStoreLinks();
  const android = /android/i.test(ua);
  const appStore = stores.appStoreReady ? stores.appStore : APP_STORE;
  const playStore = stores.playStoreReady ? stores.playStore : null;
  const links = [
    { href: appStore, label: "App Store", primary: !android || !playStore },
    ...(playStore ? [{ href: playStore, label: "Google Play", primary: android }] : []),
  ].sort((a, b) => Number(b.primary) - Number(a.primary));

  return (
    <main className="shell">
      <section className="section">
        <p className="eyebrow">Get the App</p>
        <h1>Download Venturo</h1>
        <p className="lede">Pick the store on your phone. Membership discounts live in the app.</p>
        <div className="hero-actions" style={{ marginTop: 24 }}>
          {links.map((link) => (
            <a
              key={link.label}
              className={link.primary ? "btn btn-primary" : "btn btn-secondary"}
              href={link.href}
              target="_blank"
              rel="noreferrer"
            >
              {link.label}
            </a>
          ))}
        </div>
      </section>
    </main>
  );
}
