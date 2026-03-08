import React, { useState } from 'react';
import { Upload, Check, Loader2, X } from 'lucide-react';

interface FileUploadProps {
  label: string;
  fieldKey: string;
  onUploadComplete: (key: string, url: string) => void;
  currentUrl?: string;
  accept?: string;
}

export const FileUpload: React.FC<FileUploadProps> = ({ label, fieldKey, onUploadComplete, currentUrl, accept = "image/*,application/pdf" }) => {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);

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

      const { uploadUrl, fileUrl } = await presignRes.json();
      if (!uploadUrl) throw new Error('No uploadUrl returned from server');

      // Upload the file directly to S3 using the presigned URL
      const uploadRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': file.type || 'application/octet-stream',
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
    onUploadComplete(fieldKey, '');
  };

  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <div className="flex items-center gap-3">
        {!currentUrl ? (
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
        ) : (
          <div className="flex items-center gap-2 bg-green-50 text-green-700 px-3 py-2 rounded-md border border-green-200 text-sm">
            <Check className="w-4 h-4" />
            <span className="truncate max-w-[200px]">{currentUrl.split('/').pop()}</span>
            <button
              onClick={handleClear}
              className="ml-2 p-1 hover:bg-green-100 rounded-full"
              title="Remove file"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      {currentUrl && (
        <a href={currentUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline mt-1 block">
          View uploaded file
        </a>
      )}
    </div>
  );
}