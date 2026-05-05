// lib/cloudinary.ts
// ─────────────────────────────────────────────────────────────────────────────
// Cloudinary unsigned upload utility.
// Reads credentials from .env.local:
//   NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=your_cloud_name
//   NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=5crg_ims
// ─────────────────────────────────────────────────────────────────────────────

const CLOUD_NAME    = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME!;
const UPLOAD_PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET!;

export type UploadFolder = 'inventory' | 'damage' | 'receipts';

export interface UploadResult {
  url: string;       // secure_url — the HTTPS URL to store in Firestore
  publicId: string;  // public_id  — useful if you ever want to delete the image
  width: number;
  height: number;
}

/**
 * Upload a File to Cloudinary via unsigned upload.
 *
 * @param file        The File object from an <input type="file"> or drag-and-drop
 * @param folder      'inventory' | 'damage' | 'receipts' — stored under 5crg-ims/{folder}/
 * @param onProgress  Optional callback with 0–100 progress value
 */
export async function uploadToCloudinary(
  file: File,
  folder: UploadFolder,
  onProgress?: (pct: number) => void,
): Promise<UploadResult> {
  if (!CLOUD_NAME || !UPLOAD_PRESET) {
    throw new Error(
      'Missing NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME or NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET in .env.local',
    );
  }

  // Validate file type
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (!allowed.includes(file.type)) {
    throw new Error('Only JPEG, PNG, WebP, or GIF images are allowed.');
  }

  // Validate file size (max 10 MB)
  const MAX_BYTES = 10 * 1024 * 1024;
  if (file.size > MAX_BYTES) {
    throw new Error('Image must be smaller than 10 MB.');
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', UPLOAD_PRESET);
  formData.append('folder', `5crg-ims/${folder}`);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.open('POST', `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`);

    // Progress tracking
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const data = JSON.parse(xhr.responseText);
        resolve({
          url:      data.secure_url,
          publicId: data.public_id,
          width:    data.width,
          height:   data.height,
        });
      } else {
        try {
          const err = JSON.parse(xhr.responseText);
          reject(new Error(err?.error?.message || 'Upload failed.'));
        } catch {
          reject(new Error(`Upload failed with status ${xhr.status}.`));
        }
      }
    };

    xhr.onerror = () => reject(new Error('Network error during upload.'));
    xhr.onabort = () => reject(new Error('Upload was cancelled.'));

    xhr.send(formData);
  });
}

/**
 * Delete a Cloudinary image by public_id.
 * NOTE: Unsigned deletion requires "Enable unsigned deletion" in your
 * Cloudinary settings, OR you need a server-side endpoint.
 * For now this is a placeholder — images can be managed via Cloudinary dashboard.
 */
export async function deleteFromCloudinary(publicId: string): Promise<void> {
  // Implement via a Next.js API route if you need programmatic deletion.
  console.warn('deleteFromCloudinary: not implemented client-side.', publicId);
}