"use client";

// Direct browser → Cloudinary upload using an unsigned upload preset.
// This bypasses Vercel's serverless 4.5 MB body limit entirely.

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

/**
 * Uploads a Blob directly to Cloudinary.
 * Returns the Cloudinary metadata. The caller then sends this metadata to
 * our own API (tiny JSON payload) to create the recording row.
 *
 * Supports progress via XHR.
 */
export function uploadToCloudinary(
  blob: Blob,
  onProgress?: (p: DirectUploadProgress) => void
): Promise<DirectUploadResult> {
  const { cloud, preset } = cloudinaryConfig();

  const url = `https://api.cloudinary.com/v1_1/${cloud}/video/upload`;

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);

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
        // Try to surface a useful error.
        let detail = "";
        try {
          const body = JSON.parse(xhr.responseText);
          detail = body?.error?.message ?? "";
        } catch {
          /* ignore */
        }
        reject(
          new Error(
            `Cloudinary upload failed (${xhr.status})${
              detail ? `: ${detail}` : ""
            }`
          )
        );
      }
    };

    xhr.onerror = () =>
      reject(new Error("Network error during Cloudinary upload."));
    xhr.ontimeout = () => reject(new Error("Cloudinary upload timed out."));

    const form = new FormData();
    form.append("file", blob);
    form.append("upload_preset", preset);
    form.append("resource_type", "video");
    xhr.send(form);
  });
}