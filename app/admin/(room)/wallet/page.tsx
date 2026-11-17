import { requireAdmin } from "@/lib/auth";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function WalletPage() {
  await requireAdmin();
  return (
    <section className="cr-manage">
      <header className="cr-manage-head">
        <div>
          <p className="eyebrow">Wallet</p>
          <h1>Wallet</h1>
          <p className="lede muted">
            Token artwork &amp; achievement library. Artwork changes never alter balances.
          </p>
        </div>
      </header>
      <div className="grid">
        <article className="card">
          <div className="card-body">
            <h2>Token Image</h2>
            <p className="muted">Upload, draft, publish &amp; restore token artwork.</p>
            <Link className="btn btn-secondary" href="/admin/wallet/token">
              Open Token Image
            </Link>
          </div>
        </article>
        <article className="card">
          <div className="card-body">
            <h2>Achievements</h2>
            <p className="muted">Verifiable scanned-attendance criteria only for now.</p>
            <Link className="btn btn-secondary" href="/admin/wallet/achievements">
              Open Achievements
            </Link>
          </div>
        </article>
      </div>
    </section>
  );
}
