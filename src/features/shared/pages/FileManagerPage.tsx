import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase/client';
import { useAuth } from '../../../hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Badge } from '../../../components/ui/badge';
import { Upload, FileText, Download, Trash2, Folder, Search, Image as ImageIcon, Loader2 } from 'lucide-react';
import { formatDateSafe } from '../../../lib/utils';;
import toast from 'react-hot-toast';

export function FileManagerPage() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<'all' | 'customer' | 'loan' | 'collateral'>('all');

  const { data: documents, isLoading } = useQuery({
    queryKey: ['documents', profile?.agency_id, filter],
    queryFn: async () => {
      if (!profile?.agency_id) return [];

      // Note: documents table doesn't have agency_id, so we filter by entity
      let query = supabase
        .from('documents')
        .select('*, uploaded_by:users(full_name)')
        .order('created_at', { ascending: false }) as any;

      if (filter !== 'all') {
        query = query.eq('entity_type', filter);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.agency_id,
  });

  const deleteDocument = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('documents').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      toast.success('Document deleted');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to delete document');
    },
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile?.agency_id) return;

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `agency/${profile.agency_id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('documents')
        .getPublicUrl(filePath);

      const { error: dbError } = await supabase.from('documents').insert({
        entity_type: 'other',
        entity_id: profile.agency_id || profile.id,
        document_type: 'other',
        file_url: publicUrl,
        file_name: file.name,
        file_size: file.size,
        mime_type: file.type,
        uploaded_by: profile.id,
      });

      if (dbError) throw dbError;

      queryClient.invalidateQueries({ queryKey: ['documents'] });
      toast.success('Document uploaded successfully');
    } catch (error: any) {
      toast.error(error.message || 'Failed to upload document');
    } finally {
      setUploading(false);
    }
  };

  const getDocumentTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      nrc: 'default',
      utility: 'secondary',
      payslip: 'outline',
      contract: 'default',
      other: 'outline',
    };
    return <Badge variant={colors[type] as any}>{type.toUpperCase()}</Badge>;
  };

  const getEntityTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      customer: 'default',
      loan: 'secondary',
      collateral: 'outline',
      other: 'outline',
    };
    return <Badge variant={colors[type] as any} className="capitalize">{type}</Badge>;
  };

  const filteredDocuments = documents?.filter((doc: any) =>
    doc.file_name.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">File Manager</h2>
          <p className="text-slate-600">Manage all documents and files</p>
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
                Upload File
              </>
            )}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="p-4 border-b border-slate-100">
          <div className="flex gap-4">
            <div className="relative flex-1 max-w-md">
              <Input
                placeholder="Search files..."
                className="pl-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
            </div>
            <select
              className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={filter}
              onChange={(e) => setFilter(e.target.value as any)}
            >
              <option value="all">All Types</option>
              <option value="customer">Customer</option>
              <option value="loan">Loan</option>
              <option value="collateral">Collateral</option>
            </select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
            </div>
          ) : filteredDocuments.length > 0 ? (
            <div className="divide-y">
              {filteredDocuments.map((doc: any) => (
                <div key={doc.id} className="p-6 hover:bg-slate-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 flex-1">
                      <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center">
                        {doc.mime_type?.startsWith('image/') ? (
                          <ImageIcon className="w-6 h-6 text-slate-400" />
                        ) : (
                          <FileText className="w-6 h-6 text-slate-400" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-slate-900">{doc.file_name}</h3>
                          {getDocumentTypeBadge(doc.document_type)}
                          {getEntityTypeBadge(doc.entity_type)}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-slate-500">
                          <span>{(doc.file_size / 1024).toFixed(2)} KB</span>
                          <span>Uploaded by {doc.uploaded_by?.full_name || 'Unknown'}</span>
                          <span>{formatDateSafe(doc.created_at)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => window.open(doc.file_url, '_blank')}
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => deleteDocument.mutate(doc.id)}
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
              <Folder className="w-12 h-12 mx-auto mb-4 text-slate-300" />
              <p>No documents found</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

