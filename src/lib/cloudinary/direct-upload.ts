"use client";

// Direct browser → Cloudinary upload using an unsigned upload preset.
// This bypasses Vercel's serverless 4.5 MB body limit entirely.
//
// Cloudinary allows up to 100 MB per file on the free plan.
// For long recordings on slow networks, we set a generous timeout.

export interface DirectUploadResult {
  secure_url: string;
  public_id: string;
  bytes: number;
  resource_type: string;
  format: string;
  duration?: number;
}

export interface DirectUploadProgress {
  loaded: number;
  total: number;
  percent: number;
}

function cloudinaryConfig() {
  const cloud = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const preset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
  if (!cloud || !preset) {
    throw new Error(
      "Cloudinary not configured. Missing NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME or NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET."
    );
  }
  return { cloud, preset };
}

export function uploadToCloudinary(
  blob: Blob,
  onProgress?: (p: DirectUploadProgress) => void
): Promise<DirectUploadResult> {
  const { cloud, preset } = cloudinaryConfig();

  const url = `https://api.cloudinary.com/v1_1/${cloud}/video/upload`;

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);

    // 30-minute timeout — large files on slow networks need it.
    xhr.timeout = 30 * 60 * 1000;

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress({
          loaded: e.loaded,
          total: e.total,
          percent: Math.min(99, Math.round((e.loaded / e.total) * 100)),
        });
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const result = JSON.parse(xhr.responseText) as DirectUploadResult;
          if (!result.secure_url || !result.public_id) {
            reject(new Error("Cloudinary returned an invalid response."));
            return;
          }
          onProgress?.({ loaded: 1, total: 1, percent: 100 });
          resolve(result);
        } catch {
          reject(new Error("Cloudinary returned malformed JSON."));
        }
      } else {
        let detail = "";
        try {
          const body = JSON.parse(xhr.responseText);
          detail = body?.error?.message ?? "";
        } catch {
          /* ignore */
        }
        reject(
          new Error(
            `Cloudinary rejected the file (${xhr.status})${
              detail ? `: ${detail}` : ""
            }`
          )
        );
      }
    };

    xhr.onerror = () =>
      reject(
        new Error(
          "Network error during Cloudinary upload. Check your internet connection."
        )
      );
    xhr.ontimeout = () =>
      reject(
        new Error(
          "Upload timed out. Try again on a stronger Wi-Fi connection."
        )
      );
    xhr.onabort = () => reject(new Error("Upload was cancelled."));

    const form = new FormData();
    form.append("file", blob);
    form.append("upload_preset", preset);
    form.append("resource_type", "video");
    xhr.send(form);
  });
}