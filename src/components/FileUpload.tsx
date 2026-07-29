import React, { useState } from 'react';
import { Upload, Check, Loader2, X, AlertTriangle } from 'lucide-react';
import type { ImageSpec } from '../lib/imageSpec';
import { evaluateSize } from '../lib/imageSpec';
import { useImageSpec } from '../lib/useImageSpec';

interface FileUploadProps {
  label: string;
  fieldKey: string;
  onUploadComplete: (key: string, url: string) => void;
  currentUrl?: string;
  accept?: string;
  /** When supplied, shows recommended dimensions and warns if the upload misses them. */
  spec?: ImageSpec;
}

export const FileUpload: React.FC<FileUploadProps> = ({ label, fieldKey, onUploadComplete, currentUrl, accept = "image/*,application/pdf", spec }) => {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Byte size is only knowable from the File the user picked. A draft restored
  // from localStorage carries just the URL, so the size warning is per-session
  // while the dimension warnings survive reload.
  const [uploadedBytes, setUploadedBytes] = useState<number | null>(null);
  const { messages } = useImageSpec(currentUrl, spec);

  const sizeMessages = spec && uploadedBytes !== null ? evaluateSize(uploadedBytes, spec) : [];
  const allMessages = [...sizeMessages, ...messages];

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Size is known the instant the file is picked, so this is decided before
    // any network call. Unlike the dimension rules, an over-limit file is
    // rejected outright: there is no point spending an upload round trip on a
    // file we would only tell the user to replace.
    setUploadedBytes(file.size);
    setError(null);

    if (spec && evaluateSize(file.size, spec).length > 0) {
      // Clear the input so re-picking a same-named file still fires onChange
      // after the user re-exports it smaller.
      e.target.value = '';
      return;
    }

    setUploading(true);

    try {
      // Request a presigned upload URL from the server
      const presignRes = await fetch('/api/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: file.name, contentType: file.type || 'application/octet-stream' }),
      });

      if (!presignRes.ok) {
        const errorData = await presignRes.json().catch(() => ({}));
        throw new Error(errorData.error || `Server error: ${presignRes.status}`);
      }

      const { uploadUrl, fileUrl, contentDisposition } = await presignRes.json();
      if (!uploadUrl) throw new Error('No uploadUrl returned from server');

      // Upload the file directly to S3 using the presigned URL.
      // Content-Disposition is part of the signed request, so it has to be sent
      // back byte-for-byte as the server built it or S3 rejects the signature.
      // Guarded so an older deploy that omits it keeps working.
      const uploadRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': file.type || 'application/octet-stream',
          ...(contentDisposition ? { 'Content-Disposition': contentDisposition } : {}),
        },
        body: file,
      });

      if (!uploadRes.ok) {
        const text = await uploadRes.text().catch(() => '');
        throw new Error(text || `Upload failed with status ${uploadRes.status}`);
      }

      // Notify parent of successful upload. Use the fileUrl returned by the server (public S3 URL)
      onUploadComplete(fieldKey, fileUrl || '');
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleClear = () => {
    setUploadedBytes(null);
    onUploadComplete(fieldKey, '');
  };

  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <div className="flex items-center gap-3">
        {!currentUrl ? (
          <div>
            <div className="relative">
              <input
                type="file"
                onChange={handleFileChange}
                accept={accept}
                disabled={uploading}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
              />
              <button
                type="button"
                className={`flex items-center gap-2 px-4 py-2 border rounded-md text-sm font-medium transition-colors
                  ${uploading
                    ? 'bg-gray-100 text-gray-400 border-gray-200'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
              >
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {uploading ? 'Uploading...' : 'Select File'}
              </button>
            </div>
            {spec && (
              <p className="mt-1 text-xs text-gray-500">{spec.hint}</p>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 bg-green-50 text-green-700 text-sm px-[0.8em] py-[0.5em] rounded-md border border-green-200 w-full max-w-[20ch]">
            <Check className="size-[1em] shrink-0" />
            <span className="truncate">{currentUrl.split('/').pop()}</span>
            <button
              onClick={handleClear}
              className="ml-2 p-1 hover:bg-red-50 hover:text-red-500 rounded-full cursor-pointer"
              title="Remove file"
            >
              <X className="size-[0.8em] shrink-0" />
            </button>
          </div>
        )}
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      {allMessages.length > 0 && (
        <ul className="mt-2 space-y-1 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {allMessages.map((message) => (
            <li key={message} className="flex gap-1.5">
              <AlertTriangle className="mt-px size-3.5 shrink-0" />
              <span>{message}</span>
            </li>
          ))}
        </ul>
      )}
      {currentUrl && (
        <a href={currentUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline mt-1 block">
          View uploaded file
        </a>
      )}
    </div>
  );
}