/**
 * Client-side helpers for Cloudflare R2 uploads.
 *
 * Upload flow:
 * 1. Call `presignUpload` → API returns a presigned PUT URL and an object key.
 * 2. PUT the file directly to R2 using `putToR2` (no data through the API server).
 * 3. Pass the returned `key` as `proof_key` when calling `api.manager.recordPayment`.
 *
 * @example
 * ```ts
 * const { key } = await uploadProof(file);
 * await api.manager.recordPayment({ ..., proof_key: key });
 * ```
 */

import { API_BASE } from "./api-base";

export interface PresignResult {
  upload_url: string;
  key: string;
}

/** Ask the API for a presigned PUT URL for the given file. */
export async function presignUpload(
  file: File,
  prefix = "proof",
): Promise<PresignResult> {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("access_token") : null;

  const res = await fetch(`${API_BASE}/uploads/presign`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ content_type: file.type, prefix }),
  });

  const body = await res.json();
  if (!res.ok) {
    throw new Error(body.message ?? "Failed to generate upload URL");
  }

  return body.data as PresignResult;
}

/**
 * PUT a file directly to R2 using a presigned URL.
 *
 * Throws if R2 returns a non-2xx status.
 */
export async function putToR2(uploadUrl: string, file: File): Promise<void> {
  const res = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type },
    body: file,
  });

  if (!res.ok) {
    throw new Error(`R2 upload failed: ${res.status} ${res.statusText}`);
  }
}

/**
 * End-to-end helper: presign then upload in one call.
 *
 * @returns The R2 object key to pass as `proof_key`.
 */
export async function uploadProof(file: File): Promise<string> {
  const { upload_url, key } = await presignUpload(file);
  await putToR2(upload_url, file);
  return key;
}
