"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { DIRECTORY_IMPORT_LIMIT, type DirectoryCsvRow, type DirectoryPreviewLine } from "@/lib/directory-csv";
import { commitDirectoryRows, previewDirectoryCsv } from "@/lib/directory-import";
import { createClient } from "@/lib/supabase/server";

export type DirectoryImportPreview =
  | { ok: true; lines: DirectoryPreviewLine[]; newRows: DirectoryCsvRow[] }
  | { ok: false; error: string };

export type DirectoryImportResult =
  | { ok: true; created: number }
  | { ok: false; created: number; error: string };

export async function previewDirectoryImport(formData: FormData): Promise<DirectoryImportPreview> {
  await requireAdmin();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Choose a CSV file." };
  }
  if (file.size > 1_000_000) {
    return { ok: false, error: "That file is too large. Keep it under 1 MB." };
  }

  const supabase = await createClient();
  if (!supabase) return { ok: false, error: "The directory is not connected." };

  try {
    return await previewDirectoryCsv(supabase, await file.text());
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "The directory could not be read." };
  }
}

export async function commitDirectoryImport(rows: DirectoryCsvRow[]): Promise<DirectoryImportResult> {
  const session = await requireAdmin();
  if (!Array.isArray(rows) || rows.length > DIRECTORY_IMPORT_LIMIT) {
    return { ok: false, created: 0, error: `Import up to ${DIRECTORY_IMPORT_LIMIT} rows at a time.` };
  }

  const supabase = await createClient();
  if (!supabase) return { ok: false, created: 0, error: "The directory is not connected." };

  try {
    const result = await commitDirectoryRows(supabase, rows, session.id);
    if (result.created > 0) revalidatePath("/admin/listings");
    return result;
  } catch (error) {
    return {
      ok: false,
      created: 0,
      error: error instanceof Error ? error.message : "The import did not finish.",
    };
  }
}
