import { requireAdmin } from "@/lib/auth";
import { directoryCsvDocument } from "@/lib/directory-csv";
import { loadDirectoryExportRows } from "@/lib/directory-import";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  await requireAdmin();
  const supabase = await createClient();
  if (!supabase) {
    return new Response("The directory is not connected.", { status: 503 });
  }

  try {
    const rows = await loadDirectoryExportRows(supabase);
    return new Response(directoryCsvDocument(rows), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="venturo-directory.csv"',
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The directory could not be exported.";
    return new Response(message, { status: 500 });
  }
}
