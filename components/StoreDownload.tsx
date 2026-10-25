import QRCode from "qrcode";
import { getAppStoreLinks } from "@/lib/brand";

export async function StoreDownload() {
  const stores = getAppStoreLinks();
  const appStore = stores.appStore;
  const qr = await QRCode.toDataURL(appStore, { margin: 1, width: 180, color: { dark: "#2A2D35", light: "#EBEBF3" } });

  return (
    <aside className="store-download">
      <img src={qr} alt="QR code for the Venturo app on the App Store" width={120} height={120} />
      <div>
        <p className="eyebrow">Get the app</p>
        <p>Scan for Apple. The same account works on the website.</p>
        <div className="hero-actions">
          <a className="btn btn-primary" href={appStore} target="_blank" rel="noreferrer">
            App Store
          </a>
          {stores.playStoreReady ? (
            <a className="btn btn-secondary" href={stores.playStore} target="_blank" rel="noreferrer">
              Google Play
            </a>
          ) : (
            <span className="btn btn-secondary" aria-disabled="true">
              Google Play coming
            </span>
          )}
        </div>
      </div>
    </aside>
  );
}
