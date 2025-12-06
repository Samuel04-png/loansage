/**
 * Collateral File Upload Component
 * Handles secure uploads with signed URLs and thumbnail previews
 */

import { useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Upload, X, Image as ImageIcon, FileText, Loader2 } from 'lucide-react';
import { uploadCollateralFile, deleteCollateralFile, type CollateralFile } from '../../lib/firebase/collateral-storage';
import toast from 'react-hot-toast';
import { Badge } from '../ui/badge';

interface CollateralFileUploadProps {
  agencyId: string;
  collateralId: string;
  onUploadComplete?: (files: Array<{ url: string; thumbnailUrl?: string; path: string }>) => void;
  existingFiles?: Array<{ url: string; thumbnailUrl?: string; path: string }>;
}

export function CollateralFileUpload({
  agencyId,
  collateralId,
  onUploadComplete,
  existingFiles = [],
}: CollateralFileUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<Array<{ url: string; thumbnailUrl?: string; path: string }>>(existingFiles);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setSelectedFiles(prev => [...prev, ...files]);
  };

  const removeSelectedFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) {
      toast.error('Please select files to upload');
      return;
    }

    setUploading(true);
    try {
      const uploadPromises = selectedFiles.map(file => {
        const fileType = file.type.startsWith('image/') ? 'image' : 
                        file.type === 'application/pdf' ? 'pdf' : 'document';
        
        return uploadCollateralFile(agencyId, collateralId, {
          file,
          type: fileType,
        });
      });

      const results = await Promise.all(uploadPromises);
      const newFiles = results.map(r => ({
        url: r.url,
        thumbnailUrl: r.thumbnailUrl,
        path: r.path,
      }));

      setUploadedFiles(prev => [...prev, ...newFiles]);
      setSelectedFiles([]);
      
      if (onUploadComplete) {
        onUploadComplete([...uploadedFiles, ...newFiles]);
      }

      toast.success(`${results.length} file(s) uploaded successfully`);
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error(error.message || 'Failed to upload files');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (filePath: string, index: number) => {
    try {
      await deleteCollateralFile(filePath);
      setUploadedFiles(prev => prev.filter((_, i) => i !== index));
      toast.success('File deleted successfully');
    } catch (error: any) {
      console.error('Delete error:', error);
      toast.error(error.message || 'Failed to delete file');
    }
  };

  const getFileIcon = (url: string) => {
    if (url.includes('_thumb') || url.match(/\.(jpg|jpeg|png|gif|webp)/i)) {
      return ImageIcon;
    }
    return FileText;
  };

  return (
    <div className="space-y-4">
      {/* File Selection */}
      <div>
        <Label htmlFor="file-upload">Upload Files</Label>
        <div className="mt-2 flex items-center gap-4">
          <Input
            id="file-upload"
            type="file"
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => document.getElementById('file-upload')?.click()}
            disabled={uploading}
          >
            <Upload className="mr-2 h-4 w-4" />
            Select Files
          </Button>
          {selectedFiles.length > 0 && (
            <Button
              onClick={handleUpload}
              disabled={uploading}
            >
              {uploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload {selectedFiles.length} File(s)
                </>
              )}
            </Button>
          )}
        </div>

        {/* Selected Files Preview */}
        {selectedFiles.length > 0 && (
          <div className="mt-4 space-y-2">
            {selectedFiles.map((file, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 bg-neutral-50 rounded-lg border border-neutral-200"
              >
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-neutral-400" />
                  <div>
                    <p className="text-sm font-medium text-neutral-900">{file.name}</p>
                    <p className="text-xs text-neutral-500">
                      {(file.size / 1024).toFixed(2)} KB
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeSelectedFile(index)}
                  disabled={uploading}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Uploaded Files Display */}
      {uploadedFiles.length > 0 && (
        <div>
          <Label>Uploaded Files</Label>
          <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-4">
            {uploadedFiles.map((file, index) => {
              const FileIcon = getFileIcon(file.url);
              return (
                <div
                  key={index}
                  className="relative group border border-neutral-200 rounded-lg overflow-hidden bg-neutral-50"
                >
                  {file.thumbnailUrl ? (
                    <img
                      src={file.thumbnailUrl}
                      alt={`File ${index + 1}`}
                      className="w-full h-32 object-cover"
                    />
                  ) : (
                    <div className="w-full h-32 flex items-center justify-center bg-neutral-100">
                      <FileIcon className="w-8 h-8 text-neutral-400" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => window.open(file.url, '_blank')}
                      >
                        View
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDelete(file.path, index)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

