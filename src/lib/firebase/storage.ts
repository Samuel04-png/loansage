import { ref, uploadBytes, getDownloadURL, deleteObject, UploadResult } from 'firebase/storage';
import { storage, isDemoMode } from './config';

export const storageService = {
  // Upload a file
  async upload(bucketName: string, path: string, file: File): Promise<{ error: any }> {
    if (isDemoMode) {
      return { error: null };
    }

    try {
      const storageRef = ref(storage, `${bucketName}/${path}`);
      await uploadBytes(storageRef, file);
      return { error: null };
    } catch (error: any) {
      return { error };
    }
  },

  // Get public URL for a file
  async getUrl(bucketName: string, path: string): Promise<{ publicUrl: string }> {
    if (isDemoMode) {
      return { publicUrl: `https://demo-storage.com/${bucketName}/${path}` };
    }

    try {
      const storageRef = ref(storage, `${bucketName}/${path}`);
      const url = await getDownloadURL(storageRef);
      return { publicUrl: url };
    } catch (error: any) {
      throw error;
    }
  },

  // Delete a file
  async delete(bucketName: string, path: string): Promise<{ error: any }> {
    if (isDemoMode) {
      return { error: null };
    }

    try {
      const storageRef = ref(storage, `${bucketName}/${path}`);
      await deleteObject(storageRef);
      return { error: null };
    } catch (error: any) {
      return { error };
    }
  },

  // Get public URL (convenience method that matches Supabase interface)
  getPublicUrl(bucketName: string, path: string) {
    return this.getUrl(bucketName, path);
  },
};

