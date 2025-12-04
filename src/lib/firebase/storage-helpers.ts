import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from './config';
import { isDemoMode, isSparkPlan } from './config';

/**
 * Firebase Storage helpers for file uploads
 */

export async function uploadFile(
  path: string,
  file: File,
  metadata?: { contentType?: string; customMetadata?: Record<string, string> }
): Promise<string> {
  if (isDemoMode) {
    // Return a mock URL for demo mode
    return `https://demo-storage.example.com/${path}/${file.name}`;
  }

  if (isSparkPlan) {
    // Spark plan has limited storage - return a placeholder or throw a helpful error
    throw new Error('File uploads are not available on the Spark (free) plan. Please upgrade to Blaze plan or skip file uploads.');
  }

  try {
    const storageRef = ref(storage, path);
    
    // Add timeout to prevent hanging
    const uploadPromise = uploadBytes(storageRef, file, metadata);
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Upload timeout - please check your connection')), 30000)
    );
    
    const uploadResult = await Promise.race([uploadPromise, timeoutPromise]) as any;
    const downloadURL = await getDownloadURL(uploadResult.ref);
    
    return downloadURL;
  } catch (error: any) {
    if (error.message?.includes('permission') || error.message?.includes('unauthorized')) {
      throw new Error('Storage permission denied. Please check your Firebase Storage rules.');
    }
    throw error;
  }
}

export async function uploadCustomerDocument(
  agencyId: string,
  customerId: string,
  file: File,
  documentType: 'id-front' | 'id-back' | 'selfie' | 'payslip' | 'proof-of-residence'
): Promise<string> {
  const fileExt = file.name.split('.').pop();
  const fileName = `${documentType}-${Date.now()}.${fileExt}`;
  const path = `agencies/${agencyId}/customers/${customerId}/documents/${fileName}`;
  
  return uploadFile(path, file, {
    contentType: file.type,
    customMetadata: {
      documentType,
      customerId,
      agencyId,
    },
  });
}

export async function uploadLoanDocument(
  agencyId: string,
  loanId: string,
  file: File,
  documentType: 'contract' | 'id' | 'collateral' | 'other'
): Promise<string> {
  const fileExt = file.name.split('.').pop();
  const fileName = `${documentType}-${Date.now()}.${fileExt}`;
  const path = `agencies/${agencyId}/loans/${loanId}/documents/${fileName}`;
  
  return uploadFile(path, file, {
    contentType: file.type,
    customMetadata: {
      documentType,
      loanId,
      agencyId,
    },
  });
}

export async function uploadCollateralPhoto(
  agencyId: string,
  loanId: string,
  collateralId: string,
  file: File
): Promise<string> {
  const fileExt = file.name.split('.').pop();
  const fileName = `photo-${Date.now()}.${fileExt}`;
  const path = `agencies/${agencyId}/loans/${loanId}/collateral/${collateralId}/${fileName}`;
  
  return uploadFile(path, file, {
    contentType: file.type,
    customMetadata: {
      collateralId,
      loanId,
      agencyId,
    },
  });
}

export async function uploadAgencyLogo(
  agencyId: string,
  file: File
): Promise<string> {
  const fileExt = file.name.split('.').pop();
  const fileName = `logo-${Date.now()}.${fileExt}`;
  const path = `agencies/${agencyId}/logo/${fileName}`;
  
  return uploadFile(path, file, {
    contentType: file.type,
    customMetadata: {
      agencyId,
      type: 'logo',
    },
  });
}

export async function uploadProfilePhoto(
  userId: string,
  file: File
): Promise<string> {
  const fileExt = file.name.split('.').pop();
  const fileName = `profile-${Date.now()}.${fileExt}`;
  const path = `users/${userId}/profile/${fileName}`;
  
  return uploadFile(path, file, {
    contentType: file.type,
    customMetadata: {
      userId,
      type: 'profile',
    },
  });
}

export async function deleteFile(path: string): Promise<void> {
  if (isDemoMode) return;

  const storageRef = ref(storage, path);
  await deleteObject(storageRef);
}

