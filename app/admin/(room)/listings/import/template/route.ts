import { requireAdmin } from "@/lib/auth";
import { directoryCsvTemplate } from "@/lib/directory-csv";

export async function GET() {
  await requireAdmin();
  return new Response(directoryCsvTemplate(), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="venturo-directory-template.csv"',
      "Cache-Control": "no-store",
    },
  });
}
