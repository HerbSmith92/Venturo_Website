import QRCode from "qrcode";
import { getAppStoreLinks } from "@/lib/brand";

export async function StoreDownload() {
  const stores = getAppStoreLinks();
  const appStore = stores.appStore;
  const appleQr = await QRCode.toDataURL(appStore, {
    margin: 1,
    width: 180,
    color: { dark: "#2A2D35", light: "#EBEBF3" },
  });
  const playQr = stores.playStoreReady
    ? await QRCode.toDataURL(stores.playStore, {
        margin: 1,
        width: 180,
        color: { dark: "#2A2D35", light: "#EBEBF3" },
      })
    : null;

  return (
    <aside className="store-download">
      <div className="store-download-qrs">
        <img src={appleQr} alt="QR code for the Venturo app on the App Store" width={120} height={120} />
        {playQr ? (
          <img src={playQr} alt="QR code for the Venturo app on Google Play" width={120} height={120} />
        ) : null}
      </div>
      <div>
        <p className="eyebrow">Get the app</p>
        <p>Scan for Apple or Android. The same account works on the website.</p>
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
