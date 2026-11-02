import { revalidateTag } from "next/cache";

export const PUBLIC_CATALOG_TAG = "public-catalog";

export function bustPublicCatalog() {
  revalidateTag(PUBLIC_CATALOG_TAG);
}
