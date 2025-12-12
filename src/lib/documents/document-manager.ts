/**
 * Document Management and E-Signatures
 */

import { collection, addDoc, doc, updateDoc, getDoc, getDocs, deleteDoc, query, where } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage } from '../firebase/config';
import type { DocumentTemplate, ESignature } from '../../types/features';

/**
 * Upload document
 */
export async function uploadDocument(
  agencyId: string,
  file: File,
  metadata: {
    type: string;
    relatedTo: 'loan' | 'customer' | 'collateral' | 'other';
    relatedId: string;
    uploadedBy: string;
  }
): Promise<{ id: string; url: string }> {
  const timestamp = Date.now();
  const fileName = `${metadata.type}-${timestamp}-${file.name}`;
  const storageRef = ref(storage, `agencies/${agencyId}/documents/${fileName}`);

  await uploadBytes(storageRef, file);
  const url = await getDownloadURL(storageRef);

  // Save document metadata
  const documentsRef = collection(db, 'agencies', agencyId, 'documents');
  const docRef = await addDoc(documentsRef, {
    ...metadata,
    fileName: file.name,
    fileSize: file.size,
    fileType: file.type,
    url,
    uploadedAt: new Date().toISOString(),
  });

  return { id: docRef.id, url };
}

/**
 * Get documents
 */
export async function getDocuments(
  agencyId: string,
  filters?: {
    type?: string;
    relatedTo?: 'loan' | 'customer' | 'collateral' | 'other';
    relatedId?: string;
  }
): Promise<any[]> {
  const documentsRef = collection(db, 'agencies', agencyId, 'documents');
  
  let q = query(documentsRef);
  
  if (filters?.type) {
    q = query(q, where('type', '==', filters.type));
  }
  if (filters?.relatedTo) {
    q = query(q, where('relatedTo', '==', filters.relatedTo));
  }
  if (filters?.relatedId) {
    q = query(q, where('relatedId', '==', filters.relatedId));
  }

  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    uploadedAt: doc.data().uploadedAt?.toDate() || new Date(doc.data().uploadedAt),
  }));
}

/**
 * Delete document
 */
export async function deleteDocument(agencyId: string, documentId: string): Promise<void> {
  const documentRef = doc(db, 'agencies', agencyId, 'documents', documentId);
  const documentSnap = await getDoc(documentRef);
  
  if (documentSnap.exists()) {
    const documentData = documentSnap.data();
    
    // Delete from storage
    if (documentData.url) {
      try {
        const storageRef = ref(storage, documentData.url);
        await deleteObject(storageRef);
      } catch (error) {
        console.warn('Failed to delete file from storage:', error);
      }
    }
    
    // Delete document record
    await deleteDoc(documentRef);
  }
}

/**
 * Create document template
 */
export async function createDocumentTemplate(
  agencyId: string,
  template: Omit<DocumentTemplate, 'id'>
): Promise<DocumentTemplate> {
  const templatesRef = collection(db, 'agencies', agencyId, 'document_templates');
  const docRef = await addDoc(templatesRef, template);
  
  return {
    id: docRef.id,
    ...template,
  };
}

/**
 * Generate document from template
 */
export function generateDocumentFromTemplate(
  template: DocumentTemplate,
  variables: Record<string, string>
): string {
  let content = template.content;
  
  template.variables.forEach(variable => {
    const value = variables[variable] || '';
    content = content.replace(new RegExp(`\\{${variable}\\}`, 'g'), value);
  });
  
  return content;
}

/**
 * Request e-signature
 */
export async function requestESignature(
  agencyId: string,
  documentId: string,
  signer: {
    id: string;
    name: string;
    email: string;
  }
): Promise<ESignature> {
  const signaturesRef = collection(db, 'agencies', agencyId, 'e_signatures');
  
  const signature: Omit<ESignature, 'id'> = {
    documentId,
    signerId: signer.id,
    signerName: signer.name,
    signerEmail: signer.email,
    status: 'pending',
  };

  const docRef = await addDoc(signaturesRef, signature);
  
  // In production, send email with signature link
  // For now, return the signature object
  
  return {
    id: docRef.id,
    ...signature,
  };
}

/**
 * Complete e-signature
 */
export async function completeESignature(
  agencyId: string,
  signatureId: string,
  signatureData: string,
  ipAddress: string
): Promise<void> {
  const signatureRef = doc(db, 'agencies', agencyId, 'e_signatures', signatureId);
  
  await updateDoc(signatureRef, {
    status: 'signed',
    signedAt: new Date().toISOString(),
    signatureData,
    ipAddress,
  });
}

