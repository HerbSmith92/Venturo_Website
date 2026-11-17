import { WalletTokenManager } from "@/components/admin/WalletTokenManager";
import { requireAdmin } from "@/lib/auth";
import { loadWalletTokenAdmin } from "@/lib/wallet-admin";

export const dynamic = "force-dynamic";

export default async function WalletTokenPage() {
  await requireAdmin();
  const data = await loadWalletTokenAdmin();
  return <WalletTokenManager {...data} />;
}
