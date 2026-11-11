import { ListingImportPanel } from "@/components/admin/ListingImportPanel";
import { requireAdmin } from "@/lib/auth";
import { INTEREST_CHIPS } from "@/lib/listing-draft";

export default async function DirectoryImportPage() {
  await requireAdmin();

  return (
    <section className="cr-import">
      <header className="cr-import-head">
        <p className="eyebrow">Directory</p>
        <h1>Import & Export</h1>
        <p className="cr-import-lede">
          One row is one activity business. New places land in Drafts. Anything already on the
          directory stays as it is. Photos, hours & prices wait for the draft editor.
        </p>
      </header>

      <ListingImportPanel />

      <section className="cr-import-kinds">
        <h2>Interest Keys</h2>
        <p>Put the key in the interest column.</p>
        <ul>
          {INTEREST_CHIPS.map((chip) => (
            <li key={chip.key} className={`cr-import-kind kind-${chip.key}`}>
              <span>{chip.label}</span>
              <code>{chip.key}</code>
            </li>
          ))}
        </ul>
      </section>
    </section>
  );
}
