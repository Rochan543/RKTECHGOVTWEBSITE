import { Router, type IRouter } from "express";
import { db, fileUploadsTable } from "@workspace/db";
import { requireAuth, requireAdmin, type AuthRequest } from "../../middlewares/auth";
import { getStorageProvider } from "../../lib/storage";
import { z } from "zod";
import { logger } from "../../lib/logger";

const router: IRouter = Router();

const UploadBodySchema = z.object({
  fileName: z.string().min(1).optional(),
  mimeType: z.string().min(1).optional(),
  fileData: z.string().optional(), // base64 string, optionally starting with "data:..."
  externalUrl: z.string().url().optional(),
});

// ── Generic upload ────────────────────────────────────────────────────────────
router.post("/v1/upload", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  try {
    const parsed = UploadBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const { fileName, mimeType, fileData, externalUrl } = parsed.data;
    let buffer: Buffer;
    let finalFileName = fileName || "file";
    let finalMimeType = mimeType || "application/octet-stream";

    if (fileData) {
      // Decode base64 file data
      let base64Content = fileData;
      if (fileData.includes(";base64,")) {
        const parts = fileData.split(";base64,");
        base64Content = parts[1];
        if (!mimeType && parts[0].startsWith("data:")) {
          finalMimeType = parts[0].slice(5);
        }
      }
      buffer = Buffer.from(base64Content, "base64");
    } else if (externalUrl) {
      // Fetch the file from external URL
      const fetchRes = await fetch(externalUrl);
      if (!fetchRes.ok) {
        res.status(400).json({ error: `Failed to fetch file from external URL: ${externalUrl}` });
        return;
      }
      const arrayBuffer = await fetchRes.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);

      const contentType = fetchRes.headers.get("content-type");
      if (contentType) finalMimeType = contentType;

      const urlParts = externalUrl.split("/");
      finalFileName = urlParts[urlParts.length - 1] || "external_file";
    } else {
      res.status(400).json({ error: "Either fileData or externalUrl must be provided." });
      return;
    }

    // Call storage provider
    const provider = getStorageProvider();
    const uploadResult = await provider.uploadFile(buffer, finalFileName, finalMimeType);

    // Save metadata in PostgreSQL
    const [fileRecord] = await db.insert(fileUploadsTable).values({
      fileUrl: uploadResult.fileUrl,
      publicId: uploadResult.publicId,
      fileName: uploadResult.fileName,
      mimeType: uploadResult.mimeType,
      fileSize: uploadResult.fileSize,
      uploadedBy: req.userId!,
    }).returning();

    res.status(201).json(fileRecord);
  } catch (err) {
    logger.error({ err }, "Generic upload failed");
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.toLowerCase().includes("not configured")) {
      res.status(503).json({ error: "Storage provider is not configured." });
    } else if (msg.toLowerCase().includes("limit") || msg.toLowerCase().includes("large") || msg.toLowerCase().includes("too large") || msg.toLowerCase().includes("size")) {
      res.status(400).json({ error: "This file exceeds the upload limit. Maximum supported size is 50 MB." });
    } else {
      res.status(500).json({ error: "Upload failed. Please try again." });
    }
  }
});

// ── Notes file upload ─────────────────────────────────────────────────────────
// Uploads a file to Cloudinary, persists to file_uploads, and returns both the
// file record and a ready-to-use fileUrl for creating/updating a note.
router.post("/v1/upload/notes-file", requireAdmin, async (req: AuthRequest, res): Promise<void> => {
  try {
    const schema = z.object({
      fileName: z.string().min(1),
      mimeType: z.string().min(1),
      fileData: z.string().min(1),
      fileSize: z.number().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const { fileName, mimeType, fileData } = parsed.data;
    let base64Content = fileData;
    if (fileData.includes(";base64,")) {
      base64Content = fileData.split(";base64,")[1];
    }
    const buffer = Buffer.from(base64Content, "base64");

    const provider = getStorageProvider();
    const result = await provider.uploadFile(buffer, fileName, mimeType);

    const [fileRecord] = await db.insert(fileUploadsTable).values({
      fileUrl: result.fileUrl,
      publicId: result.publicId,
      fileName: result.fileName,
      mimeType: result.mimeType,
      fileSize: result.fileSize,
      uploadedBy: req.userId!,
    }).returning();

    res.status(201).json({
      file: fileRecord,
      fileUrl: result.fileUrl,
      publicId: result.publicId,
      fileSize: result.fileSize,
    });
  } catch (err) {
    logger.error({ err }, "Notes file upload failed");
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.toLowerCase().includes("not configured")) {
      res.status(503).json({ error: "Storage provider is not configured." });
    } else if (msg.toLowerCase().includes("limit") || msg.toLowerCase().includes("large") || msg.toLowerCase().includes("too large") || msg.toLowerCase().includes("size")) {
      res.status(400).json({ error: "This file exceeds the upload limit. Maximum supported size is 50 MB." });
    } else {
      res.status(500).json({ error: "Upload failed. Please try again." });
    }
  }
});

// ── Current Affairs image upload ──────────────────────────────────────────────
// Uploads an image to Cloudinary and returns the URL; does not create any
// current-affairs record (the caller handles that separately).
router.post("/v1/upload/current-affairs-image", requireAdmin, async (req: AuthRequest, res): Promise<void> => {
  try {
    const schema = z.object({
      fileName: z.string().min(1),
      mimeType: z.string().min(1).refine(v => v.startsWith("image/"), {
        message: "Only image/* MIME types are allowed for current-affairs image upload",
      }),
      fileData: z.string().min(1),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const { fileName, mimeType, fileData } = parsed.data;
    let base64Content = fileData;
    if (fileData.includes(";base64,")) {
      base64Content = fileData.split(";base64,")[1];
    }
    const buffer = Buffer.from(base64Content, "base64");

    const provider = getStorageProvider();
    const result = await provider.uploadFile(buffer, fileName, mimeType);

    // Persist to file_uploads for tracking
    const [fileRecord] = await db.insert(fileUploadsTable).values({
      fileUrl: result.fileUrl,
      publicId: result.publicId,
      fileName: result.fileName,
      mimeType: result.mimeType,
      fileSize: result.fileSize,
      uploadedBy: req.userId!,
    }).returning();

    res.status(201).json({
      file: fileRecord,
      imageUrl: result.fileUrl,
      publicId: result.publicId,
    });
  } catch (err) {
    logger.error({ err }, "Current affairs image upload failed");
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.toLowerCase().includes("not configured")) {
      res.status(503).json({ error: "Storage provider is not configured." });
    } else if (msg.toLowerCase().includes("limit") || msg.toLowerCase().includes("large") || msg.toLowerCase().includes("too large") || msg.toLowerCase().includes("size")) {
      res.status(400).json({ error: "This file exceeds the upload limit. Maximum supported size is 50 MB." });
    } else {
      res.status(500).json({ error: "Upload failed. Please try again." });
    }
  }
});

export default router;
