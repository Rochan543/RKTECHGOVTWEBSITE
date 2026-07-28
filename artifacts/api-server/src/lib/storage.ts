import crypto from "crypto";

export interface UploadResult {
  fileUrl: string;
  publicId: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
}

export interface StorageProvider {
  uploadFile(fileBuffer: Buffer, fileName: string, mimeType: string): Promise<UploadResult>;
  deleteFile(publicId: string): Promise<void>;
}

// Used when Cloudinary credentials are not configured — returns a clear error
export class NullStorageProvider implements StorageProvider {
  async uploadFile(_fileBuffer: Buffer, _fileName: string, _mimeType: string): Promise<UploadResult> {
    throw new Error("Storage provider is not configured.");
  }
  async deleteFile(_publicId: string): Promise<void> {
    throw new Error("Storage provider is not configured.");
  }
}

export class CloudinaryStorageProvider implements StorageProvider {
  private cloudName: string;
  private apiKey: string;
  private apiSecret: string;

  constructor(cloudName: string, apiKey: string, apiSecret: string) {
    this.cloudName = cloudName;
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
  }

  async uploadFile(fileBuffer: Buffer, fileName: string, mimeType: string): Promise<UploadResult> {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const paramsToSign = `timestamp=${timestamp}${this.apiSecret}`;
    const signature = crypto.createHash("sha1").update(paramsToSign).digest("hex");

    const formData = new FormData();
    const blob = new Blob([new Uint8Array(fileBuffer)], { type: mimeType });
    formData.append("file", blob, fileName);
    formData.append("api_key", this.apiKey);
    formData.append("timestamp", timestamp);
    formData.append("signature", signature);

    const url = `https://api.cloudinary.com/v1_1/${this.cloudName}/auto/upload`;
    const res = await fetch(url, {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Cloudinary upload failed: ${text}`);
    }

    const data = (await res.json()) as any;
    return {
      fileUrl: data.secure_url,
      publicId: data.public_id,
      fileName: fileName,
      mimeType: mimeType,
      fileSize: fileBuffer.length,
    };
  }

  async deleteFile(publicId: string): Promise<void> {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const paramsToSign = `public_id=${publicId}&timestamp=${timestamp}${this.apiSecret}`;
    const signature = crypto.createHash("sha1").update(paramsToSign).digest("hex");

    const formData = new FormData();
    formData.append("public_id", publicId);
    formData.append("api_key", this.apiKey);
    formData.append("timestamp", timestamp);
    formData.append("signature", signature);

    const url = `https://api.cloudinary.com/v1_1/${this.cloudName}/image/destroy`;
    const res = await fetch(url, {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Cloudinary delete failed: ${text}`);
    }
  }
}

// Returns a CloudinaryStorageProvider if credentials are present, otherwise NullStorageProvider.
// This application uses Cloudinary exclusively for file storage.
export function getStorageProvider(): StorageProvider {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (cloudName && apiKey && apiSecret) {
    return new CloudinaryStorageProvider(cloudName, apiKey, apiSecret);
  }

  return new NullStorageProvider();
}
