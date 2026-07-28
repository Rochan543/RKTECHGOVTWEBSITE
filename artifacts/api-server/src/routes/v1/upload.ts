import { Router, type IRouter } from "express";
import { db, fileUploadsTable } from "@workspace/db";
import { requireAuth, type AuthRequest } from "../../middlewares/auth";
import { getStorageProvider } from "../../lib/storage";
import { z } from "zod";

const router: IRouter = Router();

const UploadBodySchema = z.object({
  fileName: z.string().min(1).optional(),
  mimeType: z.string().min(1).optional(),
  fileData: z.string().optional(), // base64 string, optionally starting with "data:..."
  externalUrl: z.string().url().optional(),
});

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
    const msg = err instanceof Error ? err.message : "Internal upload error";
    // Return structured error message so frontend can display "Storage provider is not configured."
    if (msg.includes("Storage provider is not configured")) {
      res.status(503).json({ error: "Storage provider is not configured." });
    } else {
      res.status(500).json({ error: msg });
    }
  }
});

export default router;
