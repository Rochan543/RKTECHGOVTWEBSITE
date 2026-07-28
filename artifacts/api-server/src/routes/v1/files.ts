/**
 * File Uploads CRUD
 * GET  /v1/files          — list all uploads (admin)
 * GET  /v1/files/:id      — get single upload
 * PUT  /v1/files/:id      — replace file content (upload new, delete old from Cloudinary)
 * DELETE /v1/files/:id    — delete from DB + Cloudinary
 */
import { Router, type IRouter } from "express";
import { db, fileUploadsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAdmin, requireAuth, type AuthRequest } from "../../middlewares/auth";
import { getStorageProvider } from "../../lib/storage";
import { z } from "zod";

const router: IRouter = Router();

// ── List ─────────────────────────────────────────────────────────────────────

router.get("/v1/files", requireAdmin, async (_req, res): Promise<void> => {
  try {
    const files = await db
      .select()
      .from(fileUploadsTable)
      .orderBy(desc(fileUploadsTable.createdAt));
    res.json({ data: files, total: files.length });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
});

// ── Get by ID ─────────────────────────────────────────────────────────────────

router.get("/v1/files/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }
  const [file] = await db.select().from(fileUploadsTable).where(eq(fileUploadsTable.id, id));
  if (!file) {
    res.status(404).json({ error: "File not found" });
    return;
  }
  res.json(file);
});

// ── Replace ───────────────────────────────────────────────────────────────────
// Accepts the same body as POST /v1/upload (fileData OR externalUrl).
// Overwrites the Cloudinary asset (same publicId → same URL), updates DB row.

const ReplaceBodySchema = z.object({
  fileName: z.string().min(1).optional(),
  mimeType: z.string().min(1).optional(),
  fileData: z.string().optional(),
  externalUrl: z.string().url().optional(),
});

router.put("/v1/files/:id", requireAdmin, async (req: AuthRequest, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const parsed = ReplaceBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [existing] = await db.select().from(fileUploadsTable).where(eq(fileUploadsTable.id, id));
  if (!existing) {
    res.status(404).json({ error: "File not found" });
    return;
  }

  const { fileName, mimeType, fileData, externalUrl } = parsed.data;
  let buffer: Buffer;
  let finalFileName = fileName || existing.fileName;
  let finalMimeType = mimeType || existing.mimeType;

  try {
    if (fileData) {
      let base64Content = fileData;
      if (fileData.includes(";base64,")) {
        const parts = fileData.split(";base64,");
        base64Content = parts[1];
        if (!mimeType && parts[0].startsWith("data:")) finalMimeType = parts[0].slice(5);
      }
      buffer = Buffer.from(base64Content, "base64");
    } else if (externalUrl) {
      const fetchRes = await fetch(externalUrl);
      if (!fetchRes.ok) {
        res.status(400).json({ error: `Failed to fetch file from URL: ${externalUrl}` });
        return;
      }
      buffer = Buffer.from(await fetchRes.arrayBuffer());
      const ct = fetchRes.headers.get("content-type");
      if (ct) finalMimeType = ct;
    } else {
      res.status(400).json({ error: "Either fileData or externalUrl must be provided." });
      return;
    }

    const provider = getStorageProvider();
    const result = await provider.replaceFile(existing.publicId, buffer, finalFileName, finalMimeType);

    const [updated] = await db
      .update(fileUploadsTable)
      .set({
        fileUrl: result.fileUrl,
        fileName: result.fileName,
        mimeType: result.mimeType,
        fileSize: result.fileSize,
      })
      .where(eq(fileUploadsTable.id, id))
      .returning();

    res.json(updated);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal error";
    res.status(msg.includes("not configured") ? 503 : 500).json({ error: msg });
  }
});

// ── Delete ────────────────────────────────────────────────────────────────────

router.delete("/v1/files/:id", requireAdmin, async (_req, res): Promise<void> => {
  const id = parseInt(_req.params.id as string, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const [file] = await db.select().from(fileUploadsTable).where(eq(fileUploadsTable.id, id));
  if (!file) {
    res.status(404).json({ error: "File not found" });
    return;
  }

  // Attempt to delete from Cloudinary; log but don't fail if provider unconfigured
  try {
    const provider = getStorageProvider();
    await provider.deleteFile(file.publicId);
  } catch (err) {
    // If storage isn't configured, still allow DB record removal
    const msg = err instanceof Error ? err.message : "";
    if (!msg.includes("not configured")) {
      res.status(500).json({ error: `Cloudinary delete failed: ${msg}` });
      return;
    }
  }

  await db.delete(fileUploadsTable).where(eq(fileUploadsTable.id, id));
  res.json({ message: "File deleted", id });
});

export default router;
