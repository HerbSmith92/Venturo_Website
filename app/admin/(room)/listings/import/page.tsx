import { ListingImportPanel } from "@/components/admin/ListingImportPanel";
import { requireAdmin } from "@/lib/auth";
import { INTEREST_CHIPS } from "@/lib/listing-draft";

export default async function DirectoryImportPage() {
  await requireAdmin();
  const interests = INTEREST_CHIPS.map((chip) => chip.key).join(", ");

  return (
    <section className="cr-paper">
      <p className="eyebrow">Directory</p>
      <h1>Import & Export</h1>
      <p className="muted">
        One row is one activity business. Download a template, export the directory, or import new
        rows. Anything already on the directory is left as it is, and every new row is saved as a
        draft. Photos, hours, and prices stay for the draft editor.
      </p>
      <p className="muted">
        Interest is an activity kind key: {interests}.
      </p>
      <div className="cr-actions">
        <a className="btn btn-secondary" href="/admin/listings/import/template">
          Download template
        </a>
        <a className="btn btn-secondary" href="/admin/listings/import/export">
          Export directory
        </a>
      </div>
      <ListingImportPanel />
    </section>
  );
}
