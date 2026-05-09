'use client';
// components/admin/MultiImageUploader.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Multi-image drag-and-drop uploader backed by Cloudinary.
// Used in InventoryTab for item images (supports multiple photos per item).
// The first image in the array is treated as the primary thumbnail.
//
// Props:
//   urls      — current array of uploaded image URLs (controlled)
//   onAdd     — called with the new URL after a successful upload
//   onRemove  — called with the index of the image to remove
//   folder    — Cloudinary upload folder ('inventory' | 'damage' | 'receipts')
//   label     — field label text (default: 'Item Images')
//   maxImages — max allowed uploads (default: 10)
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useRef, useCallback, DragEvent, ChangeEvent } from 'react';
import { uploadToCloudinary, UploadFolder } from '@/lib/cloudinary';

interface Props {
  urls: string[];
  onAdd: (url: string) => void;
  onRemove: (index: number) => void;
  folder: UploadFolder;
  label?: string;
  maxImages?: number;
}

function Spinner() {
  return (
    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
    </svg>
  );
}

// ── Lightbox ─────────────────────────────────────────────────────────────────

function Lightbox({
  urls, startIndex, onClose,
}: {
  urls: string[]; startIndex: number; onClose: () => void;
}) {
  const [idx, setIdx] = useState(startIndex);

  const prev = () => setIdx(i => (i - 1 + urls.length) % urls.length);
  const next = () => setIdx(i => (i + 1) % urls.length);

  // Keyboard nav
  if (typeof window !== 'undefined') {
    // Using inline handler is fine here since the lightbox is modal
  }

  return (
    <div
      className="fixed inset-0 bg-black/85 flex items-center justify-center z-[60] p-4"
      onClick={onClose}
      onKeyDown={e => {
        if (e.key === 'Escape') onClose();
        if (e.key === 'ArrowLeft') prev();
        if (e.key === 'ArrowRight') next();
      }}
      tabIndex={-1}
    >
      <div className="relative w-full max-w-3xl flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="bg-gray-900 text-white px-4 py-3 rounded-t-xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"/>
            </svg>
            <span className="text-sm font-semibold">Photo {idx + 1} of {urls.length}</span>
            {idx === 0 && (
              <span className="text-xs bg-purple-700 text-white px-2 py-0.5 rounded-full font-medium">Primary</span>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 bg-gray-700 hover:bg-gray-600 rounded-lg flex items-center justify-center transition"
            aria-label="Close lightbox"
          >
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* Image */}
        <div className="relative bg-gray-900 rounded-b-xl overflow-hidden">
          <img
            src={urls[idx]}
            alt={`Item photo ${idx + 1}`}
            className="w-full max-h-[75vh] object-contain"
          />
          {urls.length > 1 && (
            <>
              <button
                onClick={prev}
                className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 bg-black/50 hover:bg-black/75 rounded-full flex items-center justify-center transition"
              >
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
                </svg>
              </button>
              <button
                onClick={next}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 bg-black/50 hover:bg-black/75 rounded-full flex items-center justify-center transition"
              >
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
                </svg>
              </button>
            </>
          )}
        </div>

        {/* Dot indicators */}
        {urls.length > 1 && (
          <div className="flex items-center gap-1.5 justify-center mt-3">
            {urls.map((_, i) => (
              <button
                key={i}
                onClick={() => setIdx(i)}
                className={`rounded-full transition-all duration-200 ${
                  i === idx ? 'w-4 h-2.5 bg-white' : 'w-2.5 h-2.5 bg-white/40 hover:bg-white/70'
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function MultiImageUploader({
  urls,
  onAdd,
  onRemove,
  folder,
  label = 'Item Images',
  maxImages = 10,
}: Props) {
  const [uploading, setUploading]   = useState(false);
  const [progress, setProgress]     = useState(0);
  const [error, setError]           = useState<string | null>(null);
  const [dragOver, setDragOver]     = useState(false);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const fileInputRef                = useRef<HTMLInputElement>(null);

  const atLimit = urls.length >= maxImages;

  const handleFile = useCallback(async (file: File) => {
    if (urls.length >= maxImages) {
      setError(`Maximum ${maxImages} images allowed.`);
      return;
    }
    setError(null);
    setUploading(true);
    setProgress(0);
    try {
      const result = await uploadToCloudinary(file, folder, pct => setProgress(pct));
      onAdd(result.url);
    } catch (err: any) {
      setError(err?.message || 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
      setProgress(0);
    }
  }, [folder, onAdd, urls.length, maxImages]);

  function onInputChange(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    // Upload sequentially to avoid hammering Cloudinary
    files.reduce((chain, f) => chain.then(() => handleFile(f)), Promise.resolve());
    e.target.value = '';
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    if (atLimit) return;
    const files = Array.from(e.dataTransfer.files || []);
    files.reduce((chain, f) => chain.then(() => handleFile(f)), Promise.resolve());
  }

  return (
    <div>
      {/* Label */}
      <div className="flex items-center justify-between mb-1.5">
        <label className="block text-sm font-medium text-gray-700">
          {label}
          <span className="text-xs text-gray-400 font-normal ml-1">(optional — up to {maxImages} photos)</span>
        </label>
        {urls.length > 0 && (
          <span className="text-xs text-gray-400">{urls.length}/{maxImages} uploaded</span>
        )}
      </div>

      {/* Image grid */}
      {urls.length > 0 && (
        <div className="grid grid-cols-4 gap-2 mb-3">
          {urls.map((url, i) => (
            <div key={i} className="relative group aspect-square rounded-xl overflow-hidden bg-gray-100">
              {/* Primary badge */}
              {i === 0 && (
                <div className="absolute top-1.5 left-1.5 z-10 bg-purple-700 text-white text-xs font-semibold px-1.5 py-0.5 rounded-md leading-none pointer-events-none">
                  Primary
                </div>
              )}

              <img
                src={url}
                alt={`Item photo ${i + 1}`}
                className="w-full h-full object-cover cursor-pointer"
                onClick={() => setLightboxIdx(i)}
              />

              {/* Hover overlay */}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/45 transition flex items-center justify-center gap-1.5 opacity-0 group-hover:opacity-100">
                {/* View button */}
                <button
                  type="button"
                  onClick={() => setLightboxIdx(i)}
                  className="p-1.5 bg-white rounded-lg hover:bg-gray-100 transition"
                  title="View full size"
                >
                  <svg className="w-3.5 h-3.5 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                  </svg>
                </button>
                {/* Remove button */}
                <button
                  type="button"
                  onClick={() => onRemove(i)}
                  className="p-1.5 bg-red-600 rounded-lg hover:bg-red-700 transition"
                  title="Remove photo"
                >
                  <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                  </svg>
                </button>
              </div>

              {/* Photo number */}
              <div className="absolute bottom-1 right-1 bg-black/50 text-white text-xs px-1.5 py-0.5 rounded-md font-medium pointer-events-none">
                #{i + 1}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Primary image note */}
      {urls.length > 1 && (
        <p className="text-xs text-purple-700 mb-2 flex items-center gap-1">
          <svg className="w-3.5 h-3.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd"/>
          </svg>
          Photo #1 is used as the thumbnail in tables and the borrow picker.
        </p>
      )}

      {/* Drop zone — hidden when at limit */}
      {!atLimit && (
        <div
          onDrop={onDrop}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onClick={() => !uploading && fileInputRef.current?.click()}
          role="button"
          aria-label="Upload item photos"
          tabIndex={0}
          onKeyDown={e => e.key === 'Enter' && fileInputRef.current?.click()}
          className={`relative border-2 border-dashed rounded-xl transition cursor-pointer p-5
            ${dragOver
              ? 'border-purple-500 bg-purple-50'
              : uploading
                ? 'border-gray-300 bg-gray-50 cursor-not-allowed'
                : 'border-gray-300 bg-gray-50 hover:border-purple-400 hover:bg-purple-50/50'
            }`}
        >
          {uploading ? (
            <div className="flex flex-col items-center gap-3">
              <Spinner/>
              <div className="w-full max-w-[200px] mx-auto">
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
            <div className="flex items-center gap-4">
              <div className={`w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 ${dragOver ? 'bg-purple-100' : 'bg-gray-100'}`}>
                <svg
                  className={`w-5 h-5 ${dragOver ? 'text-purple-500' : 'text-gray-400'}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"/>
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">
                  <span className="text-purple-600">Click to upload</span> or drag & drop
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  JPEG, PNG, WebP — max 10 MB each
                  {urls.length > 0 && ` · ${maxImages - urls.length} slot${maxImages - urls.length !== 1 ? 's' : ''} remaining`}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* At limit message */}
      {atLimit && (
        <div className="border border-gray-200 rounded-xl px-4 py-3 bg-gray-50 flex items-center gap-2">
          <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
          </svg>
          <p className="text-xs text-gray-500">Maximum of {maxImages} photos reached. Remove one to upload another.</p>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        multiple
        className="hidden"
        onChange={onInputChange}
        disabled={uploading || atLimit}
      />

      {/* Error */}
      {error && (
        <div className="mt-2 flex items-center gap-1.5 text-xs text-red-600">
          <svg className="w-3.5 h-3.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"/>
          </svg>
          {error}
        </div>
      )}

      {/* Lightbox */}
      {lightboxIdx !== null && (
        <Lightbox
          urls={urls}
          startIndex={lightboxIdx}
          onClose={() => setLightboxIdx(null)}
        />
      )}
    </div>
  );
}