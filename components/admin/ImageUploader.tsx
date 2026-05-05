'use client';
// components/admin/ImageUploader.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Reusable drag-and-drop image uploader backed by Cloudinary.
// Used in:
//   • InventoryTab  — item image (folder: 'inventory')
//   • BorrowedTab   — damage photo (folder: 'damage')
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useRef, useCallback, DragEvent, ChangeEvent } from 'react';
import { uploadToCloudinary, UploadFolder } from '@/lib/cloudinary';

interface Props {
  folder: UploadFolder;
  currentUrl: string | null;
  onUploaded: (url: string) => void;
  onRemove: () => void;
  label?: string;
  optional?: boolean;
  hint?: string;
  compact?: boolean; // smaller layout for damage photo in modal
}

function Spinner() {
  return (
    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
    </svg>
  );
}

export default function ImageUploader({
  folder, currentUrl, onUploaded, onRemove,
  label = 'Item Image', optional = true, hint, compact = false,
}: Props) {
  const [uploading, setUploading]   = useState(false);
  const [progress, setProgress]     = useState(0);
  const [error, setError]           = useState<string | null>(null);
  const [dragOver, setDragOver]     = useState(false);
  const fileInputRef                = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    setError(null);
    setUploading(true);
    setProgress(0);
    try {
      const result = await uploadToCloudinary(file, folder, pct => setProgress(pct));
      onUploaded(result.url);
    } catch (err: any) {
      setError(err?.message || 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
      setProgress(0);
    }
  }, [folder, onUploaded]);

  function onInputChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    // Reset input so same file can be re-selected after remove
    e.target.value = '';
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  function onDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(true);
  }

  function onDragLeave() { setDragOver(false); }

  // ── If image already uploaded — show preview ──────────────────────────────
  if (currentUrl) {
    return (
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          {label}
          {optional && <span className="text-xs text-gray-400 font-normal ml-1">(optional)</span>}
        </label>
        <div className={`relative rounded-xl overflow-hidden bg-gray-100 ${compact ? 'h-32' : 'h-44'}`}>
          <img src={currentUrl} alt="Uploaded preview" className="w-full h-full object-cover"/>
          {/* Overlay controls */}
          <div className="absolute inset-0 bg-black/0 hover:bg-black/40 transition flex items-center justify-center gap-2 opacity-0 hover:opacity-100">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1.5 bg-white rounded-lg text-xs font-semibold text-gray-800 hover:bg-gray-100 transition"
            >
              Replace
            </button>
            <button
              type="button"
              onClick={onRemove}
              className="px-3 py-1.5 bg-red-600 rounded-lg text-xs font-semibold text-white hover:bg-red-700 transition"
            >
              Remove
            </button>
          </div>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={onInputChange}
        />
        {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
      </div>
    );
  }

  // ── No image yet — show drop zone ─────────────────────────────────────────
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">
        {label}
        {optional && <span className="text-xs text-gray-400 font-normal ml-1">(optional)</span>}
      </label>

      <div
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onClick={() => !uploading && fileInputRef.current?.click()}
        role="button"
        aria-label="Upload image"
        tabIndex={0}
        onKeyDown={e => e.key === 'Enter' && fileInputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-xl transition cursor-pointer
          ${compact ? 'p-4' : 'p-6'}
          ${dragOver
            ? 'border-purple-500 bg-purple-50'
            : uploading
              ? 'border-gray-300 bg-gray-50 cursor-not-allowed'
              : 'border-gray-300 bg-gray-50 hover:border-purple-400 hover:bg-purple-50/50'
          }`}
      >
        {uploading ? (
          /* Upload progress */
          <div className="flex flex-col items-center gap-3">
            <Spinner/>
            <div className="w-full max-w-[180px]">
              <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-purple-600 rounded-full transition-all duration-200"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 text-center mt-1.5">Uploading {progress}%…</p>
            </div>
          </div>
        ) : (
          /* Idle state */
          <div className={`flex flex-col items-center gap-2 ${compact ? '' : 'py-2'}`}>
            <div className={`rounded-full bg-gray-100 flex items-center justify-center
              ${dragOver ? 'bg-purple-100' : ''} ${compact ? 'w-9 h-9' : 'w-12 h-12'}`}>
              <svg
                className={`text-gray-400 ${dragOver ? 'text-purple-500' : ''} ${compact ? 'w-4 h-4' : 'w-6 h-6'}`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"/>
              </svg>
            </div>
            {!compact && (
              <div className="text-center">
                <p className="text-sm font-medium text-gray-600">
                  <span className="text-purple-600">Click to upload</span> or drag & drop
                </p>
                <p className="text-xs text-gray-400 mt-0.5">JPEG, PNG, WebP — max 10 MB</p>
              </div>
            )}
            {compact && (
              <p className="text-xs text-gray-500 text-center">Click or drag photo here</p>
            )}
          </div>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={onInputChange}
        disabled={uploading}
      />

      {error && (
        <div className="mt-2 flex items-center gap-1.5 text-xs text-red-600">
          <svg className="w-3.5 h-3.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"/>
          </svg>
          {error}
        </div>
      )}
      {hint && !error && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}