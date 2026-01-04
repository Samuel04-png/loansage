import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { collection, getDocs, query as firestoreQuery, where, orderBy, doc, deleteDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../lib/firebase/config';
import { useAuth } from '../../../hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Badge } from '../../../components/ui/badge';
import { Skeleton } from '../../../components/ui/skeleton';
import { EmptyState } from '../../../components/ui/empty-state';
import { Upload, FileText, Download, Trash2, Loader2, Image as ImageIcon } from 'lucide-react';
import { formatDateSafe } from '../../../lib/utils';
import toast from 'react-hot-toast';
import { uploadCustomerDocument } from '../../../lib/firebase/storage-helpers';
import { motion } from 'framer-motion';

export function DocumentsPage() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);

  // Find customer by user ID
  const { data: customer } = useQuery({
    queryKey: ['customer-by-user', profile?.id, profile?.agency_id],
    queryFn: async () => {
      if (!profile?.id || !profile?.agency_id) return null;

      const customersRef = collection(db, 'agencies', profile.agency_id, 'customers');
      const q = firestoreQuery(customersRef, where('userId', '==', profile.id));
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) return null;
      return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
    },
    enabled: !!profile?.id && !!profile?.agency_id,
  });

  const { data: documents, isLoading } = useQuery({
    queryKey: ['customer-documents', customer?.id, profile?.agency_id],
    queryFn: async () => {
      if (!customer?.id || !profile?.agency_id) return [];

      try {
        const documentsRef = collection(
          db,
          'agencies',
          profile.agency_id,
          'customers',
          customer.id,
          'documents'
        );
        const q = firestoreQuery(documentsRef, orderBy('uploadedAt', 'desc'));
        const snapshot = await getDocs(q);
        
        return snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          uploadedAt: doc.data().uploadedAt?.toDate?.() || doc.data().uploadedAt,
        }));
      } catch (error: any) {
        console.error('Error fetching customer documents:', error);
        return [];
      }
    },
    enabled: !!customer?.id && !!profile?.agency_id,
  });

  const deleteDocument = useMutation({
    mutationFn: async ({ docId, customerId }: { docId: string; customerId: string }) => {
      if (!profile?.agency_id) throw new Error('Agency not found');
      
      const docRef = doc(
        db,
        'agencies',
        profile.agency_id,
        'customers',
        customerId,
        'documents',
        docId
      );
      await deleteDoc(docRef);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-documents'] });
      toast.success('Document deleted');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to delete document');
    },
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !customer?.id || !profile?.agency_id) return;

    setUploading(true);
    try {
      // Upload to Firebase Storage
      const fileURL = await uploadCustomerDocument(
        profile.agency_id,
        customer.id,
        file,
        'other'
      );

      // Save document reference in Firestore
      const documentsRef = collection(
        db,
        'agencies',
        profile.agency_id,
        'customers',
        customer.id,
        'documents'
      );

      await addDoc(documentsRef, {
        type: 'other',
        fileURL,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        uploadedBy: profile.id,
        uploadedAt: serverTimestamp(),
      });

      queryClient.invalidateQueries({ queryKey: ['customer-documents'] });
      toast.success('Document uploaded successfully');
    } catch (error: any) {
      toast.error(error.message || 'Failed to upload document');
    } finally {
      setUploading(false);
    }
  };

  const getDocumentTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      'id-front': 'default',
      'id-back': 'default',
      'selfie': 'secondary',
      'payslip': 'outline',
      'proof-of-residence': 'outline',
      'other': 'outline',
    };
    return <Badge variant={colors[type] as any}>{type?.replace('-', ' ').toUpperCase() || 'OTHER'}</Badge>;
  };

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex justify-between items-center flex-wrap gap-4"
      >
        <div>
          <h1 className="page-title text-neutral-900 dark:text-neutral-100 mb-1">Documents</h1>
          <p className="helper-text">Upload and manage your documents</p>
        </div>
        <div>
          <Input
            type="file"
            id="file-upload"
            className="hidden"
            onChange={handleFileUpload}
            disabled={uploading}
          />
          <Button
            onClick={() => document.getElementById('file-upload')?.click()}
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
                Upload Document
              </>
            )}
          </Button>
        </div>
      </motion.div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
            </div>
          ) : documents && documents.length > 0 ? (
            <div className="divide-y">
              {documents.map((doc: any) => (
                <div key={doc.id} className="p-6 hover:bg-slate-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 flex-1">
                      <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center">
                        {doc.mimeType?.startsWith('image/') ? (
                          <ImageIcon className="w-6 h-6 text-slate-400" />
                        ) : (
                          <FileText className="w-6 h-6 text-slate-400" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-slate-900">{doc.fileName || 'Document'}</h3>
                          {getDocumentTypeBadge(doc.type)}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-slate-500">
                          <span>{doc.fileSize ? `${(doc.fileSize / 1024).toFixed(2)} KB` : '-'}</span>
                          <span>Uploaded {formatDateSafe(doc.uploadedAt)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => window.open(doc.fileURL, '_blank')}
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => deleteDocument.mutate({ docId: doc.id, customerId: customer!.id })}
                        disabled={deleteDocument.isPending}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-slate-500">
              <FileText className="w-12 h-12 mx-auto mb-4 text-slate-300" />
              <p>No documents uploaded yet</p>
              <p className="text-sm mt-2">Upload your first document to get started</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
