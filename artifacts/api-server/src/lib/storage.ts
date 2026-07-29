import crypto from "crypto";
import { v2 as cloudinary } from "cloudinary";
import fs from "fs";
import os from "os";
import path from "path";
import { Readable } from "stream";
import { logger } from "./logger";

export interface UploadResult {
  fileUrl: string;
  publicId: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
}

export interface StorageProvider {
  uploadFile(fileBuffer: Buffer, fileName: string, mimeType: string): Promise<UploadResult>;
  replaceFile(publicId: string, fileBuffer: Buffer, fileName: string, mimeType: string): Promise<UploadResult>;
  deleteFile(publicId: string): Promise<void>;
}

// Used when Cloudinary credentials are not configured — returns a clear error
export class NullStorageProvider implements StorageProvider {
  async uploadFile(_fileBuffer: Buffer, _fileName: string, _mimeType: string): Promise<UploadResult> {
    throw new Error("Storage provider is not configured.");
  }
  async replaceFile(_publicId: string, _fileBuffer: Buffer, _fileName: string, _mimeType: string): Promise<UploadResult> {
    throw new Error("Storage provider is not configured.");
  }
  async deleteFile(_publicId: string): Promise<void> {
    throw new Error("Storage provider is not configured.");
  }
}

export class CloudinaryStorageProvider implements StorageProvider {
  constructor(cloudName: string, apiKey: string, apiSecret: string) {
    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
    });
  }

  private getCloudinaryErrorMessage(err: any): string {
    if (!err) return "Unknown error";
    if (typeof err === "string") return err;
    if (err.message) return err.message;
    if (err.error && typeof err.error === "object" && err.error.message) {
      return err.error.message;
    }
    if (err.error && typeof err.error === "string") {
      return err.error;
    }
    try {
      return JSON.stringify(err);
    } catch {
      return String(err);
    }
  }

  private async uploadStream(
    fileBuffer: Buffer,
    fileName: string,
    mimeType: string,
    resourceType: string,
    publicId?: string
  ): Promise<UploadResult> {
    try {
      const options: any = {
        resource_type: resourceType,
      };

      if (publicId) {
        options.public_id = publicId;
        options.overwrite = true;
        options.invalidate = true;
      } else if (resourceType === "raw") {
        const ext = path.extname(fileName) || ".pdf";
        options.public_id = `${crypto.randomUUID()}${ext}`;
      }

      const result = await new Promise<any>((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(options, (error, res) => {
          if (error) {
            reject(error);
          } else {
            resolve(res);
          }
        });
        Readable.from(fileBuffer).pipe(stream);
      });

      return {
        fileUrl: result.secure_url,
        publicId: result.public_id,
        fileName: fileName,
        mimeType: mimeType,
        fileSize: fileBuffer.length,
      };
    } catch (err: any) {
      logger.error({ err, fileName }, "Cloudinary stream upload failed");
      const msg = this.getCloudinaryErrorMessage(err);
      throw new Error(`Cloudinary upload failed: ${msg}`);
    }
  }

  private async uploadChunked(
    fileBuffer: Buffer,
    fileName: string,
    mimeType: string,
    resourceType: string,
    publicId?: string
  ): Promise<UploadResult> {
    let targetPublicId = publicId;
    if (resourceType === "raw" && !publicId) {
      const ext = path.extname(fileName) || ".pdf";
      targetPublicId = `${crypto.randomUUID()}${ext}`;
    } else if (resourceType === "raw" && publicId && !publicId.includes(".")) {
      const ext = path.extname(fileName) || ".pdf";
      targetPublicId = `${publicId}${ext}`;
    }

    const tempPath = path.join(os.tmpdir(), `upload_${crypto.randomUUID()}_${fileName}`);
    await fs.promises.writeFile(tempPath, fileBuffer);

    try {
      const options: any = {
        resource_type: resourceType,
        chunk_size: 6000000, // 6MB chunks
      };

      if (targetPublicId) {
        options.public_id = targetPublicId;
        options.overwrite = true;
        options.invalidate = true;
      }

      const result = await new Promise<any>((resolve, reject) => {
        cloudinary.uploader.upload_large(tempPath, options, (error, res) => {
          if (error) {
            reject(error);
          } else {
            resolve(res);
          }
        });
      });

      return {
        fileUrl: result.secure_url,
        publicId: result.public_id,
        fileName: fileName,
        mimeType: mimeType,
        fileSize: fileBuffer.length,
      };
    } catch (err: any) {
      logger.error({ err, fileName }, "Cloudinary chunked upload failed");
      const msg = this.getCloudinaryErrorMessage(err);
      if (msg.toLowerCase().includes("limit") || msg.toLowerCase().includes("large") || msg.toLowerCase().includes("too large") || msg.toLowerCase().includes("size")) {
        throw new Error("File size too large. Got " + fileBuffer.length + " bytes.");
      }
      throw new Error(`Cloudinary upload failed: ${msg}`);
    } finally {
      await fs.promises.unlink(tempPath).catch(() => {});
    }
  }

  private async verifyUpload(
    url: string,
    originalBuffer: Buffer,
    expectedMimeType: string,
    expectedResourceType: string
  ): Promise<void> {
    try {
      const res = await fetch(url);
      if (!res.ok) {
        if (res.status === 401) {
          throw new Error(
            "Cloudinary returned 401 Unauthorized. This typically means 'Allow delivery of PDF and ZIP files' is disabled in your Cloudinary Settings -> Security panel."
          );
        }
        throw new Error(`Integrity check failed: Got HTTP status ${res.status} when fetching uploaded file`);
      }

      const downloadedBuffer = Buffer.from(await res.arrayBuffer());

      if (downloadedBuffer.length !== originalBuffer.length) {
        throw new Error(
          `Integrity check failed: File size mismatch. Original: ${originalBuffer.length} bytes, Uploaded: ${downloadedBuffer.length} bytes`
        );
      }

      const originalHash = crypto.createHash("sha256").update(originalBuffer).digest("hex");
      const downloadedHash = crypto.createHash("sha256").update(downloadedBuffer).digest("hex");
      if (originalHash !== downloadedHash) {
        throw new Error("Integrity check failed: SHA-256 hash mismatch");
      }

      if (expectedMimeType === "application/pdf" || url.endsWith(".pdf")) {
        const firstBytes = downloadedBuffer.subarray(0, 4).toString("ascii");
        if (firstBytes !== "%PDF") {
          throw new Error(`Integrity check failed: PDF signature mismatch. Expected %PDF, got: ${firstBytes}`);
        }
      }
    } catch (err: any) {
      logger.error({ err, url }, "Upload integrity verification failed");
      throw err;
    }
  }

  async uploadFile(fileBuffer: Buffer, fileName: string, mimeType: string): Promise<UploadResult> {
    const isImage = mimeType.startsWith("image/");
    const resourceType = isImage ? "image" : "raw";

    let result: UploadResult;
    if (fileBuffer.length > 5 * 1024 * 1024) {
      result = await this.uploadChunked(fileBuffer, fileName, mimeType, resourceType);
    } else {
      result = await this.uploadStream(fileBuffer, fileName, mimeType, resourceType);
    }

    await this.verifyUpload(result.fileUrl, fileBuffer, mimeType, resourceType);

    return result;
  }

  async replaceFile(publicId: string, fileBuffer: Buffer, fileName: string, mimeType: string): Promise<UploadResult> {
    const isImage = mimeType.startsWith("image/");
    const resourceType = isImage ? "image" : "raw";

    let targetPublicId = publicId;
    if (resourceType === "raw" && !publicId.includes(".")) {
      const ext = path.extname(fileName) || ".pdf";
      targetPublicId = `${publicId}${ext}`;
    }

    let result: UploadResult;
    if (fileBuffer.length > 5 * 1024 * 1024) {
      result = await this.uploadChunked(fileBuffer, fileName, mimeType, resourceType, targetPublicId);
    } else {
      result = await this.uploadStream(fileBuffer, fileName, mimeType, resourceType, targetPublicId);
    }

    await this.verifyUpload(result.fileUrl, fileBuffer, mimeType, resourceType);

    return result;
  }

  async deleteFile(publicId: string): Promise<void> {
    try {
      const isRaw = publicId.endsWith(".pdf") || publicId.endsWith(".zip") || !publicId.includes(".");
      
      if (isRaw) {
        const result = await cloudinary.uploader.destroy(publicId, {
          resource_type: "raw",
        });
        if (result.result !== "ok") {
          await cloudinary.uploader.destroy(publicId, {
            resource_type: "image",
          });
        }
      } else {
        const result = await cloudinary.uploader.destroy(publicId, {
          resource_type: "image",
        });
        if (result.result !== "ok") {
          await cloudinary.uploader.destroy(publicId, {
            resource_type: "raw",
          });
        }
      }
    } catch (err: any) {
      logger.error({ err, publicId }, "Cloudinary delete failed");
      const msg = this.getCloudinaryErrorMessage(err);
      throw new Error(`Cloudinary delete failed: ${msg}`);
    }
  }
}

// Returns a CloudinaryStorageProvider if credentials are present, otherwise NullStorageProvider.
export function getStorageProvider(): StorageProvider {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (cloudName && apiKey && apiSecret) {
    return new CloudinaryStorageProvider(cloudName, apiKey, apiSecret);
  }

  return new NullStorageProvider();
}
