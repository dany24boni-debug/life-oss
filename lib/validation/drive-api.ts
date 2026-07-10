/**
 * Runtime validation for Google Drive REST v3 response bodies.
 *
 * Why zod here: Drive's response shape can change. Today we depend
 * on a thin slice (`id`, `name`, `nextPageToken`). If Google ever
 * returns a malformed body — or renames a field — we want a clean
 * "drive_api_error: schema_mismatch" instead of a runtime crash
 * deep inside the journal helper.
 *
 * Schemas are deliberately minimal: only the fields the helper
 * actually reads. Unknown extra keys pass through silently
 * (z.object default behaviour) — Google can add new fields without
 * breaking us.
 */

import { z } from "zod";

// ============================================================
// Common file/folder metadata (we request fields=id,name only)
// ============================================================

export const DriveFileMetadataSchema = z.object({
  id: z.string().min(1),
  name: z.string().optional(),
});
export type DriveFileMetadata = z.infer<typeof DriveFileMetadataSchema>;

// ============================================================
// GET drive/v3/files?q=... — list / find response
// ============================================================

export const DriveFilesListSchema = z.object({
  files: z.array(DriveFileMetadataSchema).optional(),
  nextPageToken: z.string().optional(),
});
export type DriveFilesList = z.infer<typeof DriveFilesListSchema>;

// ============================================================
// POST drive/v3/files (or upload variant) — create response.
// Requested with fields=id, so the body is { id: "..." }.
// ============================================================

export const DriveFileCreateSchema = z.object({
  id: z.string().min(1),
});
export type DriveFileCreate = z.infer<typeof DriveFileCreateSchema>;
