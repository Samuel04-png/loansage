import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase/config';
import { useAuth } from '../../../hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { ArrowLeft, Image as ImageIcon, FileText, DollarSign, Calendar, CheckCircle2, Clock, XCircle, MapPin, Sparkles, TrendingUp } from 'lucide-react';
import { formatCurrency, formatDateSafe } from '../../../lib/utils';
import { Loader2 } from 'lucide-react';
import { useState } from 'react';
import { estimateCollateralPrice, calculateCollateralProfit } from '../../../lib/ai/collateral-pricing';
import toast from 'react-hot-toast';

export function CollateralDetailPage() {
  const { loanId, collateralId } = useParams<{ loanId?: string; collateralId: string }>();
  const { profile } = useAuth();
  const [aiValuation, setAiValuation] = useState<any>(null);
  const [loadingValuation, setLoadingValuation] = useState(false);

  // Fetch loan details
  const { data: loan } = useQuery({
    queryKey: ['loan', profile?.agency_id, loanId],
    queryFn: async () => {
      if (!profile?.agency_id || !loanId) return null;
      const loanRef = doc(db, 'agencies', profile.agency_id, 'loans', loanId);
      const loanSnap = await getDoc(loanRef);
      if (!loanSnap.exists()) return null;
      return { id: loanSnap.id, ...loanSnap.data() };
    },
    enabled: !!profile?.agency_id && !!loanId,
  });

  // Fetch collateral details - try top-level registry first, then loan subcollection
  const { data: collateral, isLoading } = useQuery({
    queryKey: ['collateral', profile?.agency_id, loanId, collateralId],
    queryFn: async () => {
      if (!profile?.agency_id || !collateralId) return null;

      // Try top-level collateral registry first
      try {
        const registryRef = doc(db, 'agencies', profile.agency_id, 'collateral', collateralId);
        const registrySnap = await getDoc(registryRef);
        
        if (registrySnap.exists()) {
          return { id: registrySnap.id, ...registrySnap.data() };
        }
      } catch (error) {
        console.warn('Failed to fetch from registry:', error);
      }

      // Fallback to loan subcollection if loanId provided
      if (loanId) {
        try {
          const collateralRef = doc(
            db,
            'agencies',
            profile.agency_id,
            'loans',
            loanId,
            'collateral',
            collateralId
          );
          const collateralSnap = await getDoc(collateralRef);
          
          if (collateralSnap.exists()) {
            return { id: collateralSnap.id, ...collateralSnap.data() };
          }
        } catch (error) {
          console.warn('Failed to fetch from loan subcollection:', error);
        }
      }

      return null;
    },
    enabled: !!profile?.agency_id && !!collateralId,
  });

  // Fetch customer details
  const { data: customer } = useQuery({
    queryKey: ['customer', profile?.agency_id, loan?.customerId],
    queryFn: async () => {
      if (!profile?.agency_id || !loan?.customerId) return null;
      const customerRef = doc(db, 'agencies', profile.agency_id, 'customers', loan.customerId);
      const customerSnap = await getDoc(customerRef);
      if (!customerSnap.exists()) return null;
      return { id: customerSnap.id, ...customerSnap.data() };
    },
    enabled: !!profile?.agency_id && !!loan?.customerId,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    );
  }

  if (!collateral) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-500">Collateral not found</p>
        <Link to={loanId ? `/admin/loans/${loanId}` : '/admin/loans'}>
          <Button variant="outline" className="mt-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Loan
          </Button>
        </Link>
      </div>
    );
  }

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'verified':
        return <Badge variant="success" className="flex items-center gap-1 w-fit"><CheckCircle2 className="w-3 h-3" /> Verified</Badge>;
      case 'pending':
        return <Badge variant="warning" className="flex items-center gap-1 w-fit"><Clock className="w-3 h-3" /> Pending</Badge>;
      case 'rejected':
        return <Badge variant="destructive" className="flex items-center gap-1 w-fit"><XCircle className="w-3 h-3" /> Rejected</Badge>;
      default:
        return <Badge variant="outline">{status || 'Unknown'}</Badge>;
    }
  };

  const photos = collateral.photos || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to={loanId ? `/admin/loans/${loanId}` : '/admin/loans'}>
            <Button variant="outline" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Collateral Details</h2>
            <p className="text-slate-600">{collateral.type?.replace('_', ' ').toUpperCase() || 'Collateral'}</p>
          </div>
        </div>
        {getStatusBadge(collateral.verificationStatus || collateral.status)}
      </div>

      {/* Collateral Information */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Collateral Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-slate-500">Type</p>
              <p className="font-semibold capitalize">{collateral.type?.replace('_', ' ') || 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Description</p>
              <p className="font-semibold">{collateral.description || 'No description provided'}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Estimated Value</p>
              <p className="font-semibold text-lg flex items-center gap-2">
                <DollarSign className="w-5 h-5" />
                {formatCurrency(Number(collateral.estimatedValue || collateral.value || 0), collateral.currency || 'ZMW')}
              </p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Collateral ID</p>
              <p className="font-mono text-sm">{collateral.id}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Created</p>
              <p className="font-semibold flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                {formatDateSafe(collateral.createdAt)}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Related Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {loan && (
              <div>
                <p className="text-sm text-slate-500">Loan</p>
                <Link to={`/admin/loans/${loan.id}`}>
                  <p className="font-semibold text-primary-600 hover:underline">{loan.id}</p>
                </Link>
                <p className="text-xs text-slate-500">
                  Amount: {formatCurrency(Number(loan.amount || 0), 'ZMW')}
                </p>
              </div>
            )}
            {customer && (
              <div>
                <p className="text-sm text-slate-500">Customer</p>
                <Link to={`/admin/customers/${customer.id}`}>
                  <p className="font-semibold text-primary-600 hover:underline">{customer.fullName || 'N/A'}</p>
                </Link>
                <p className="text-xs text-slate-500">{customer.email || customer.phone || ''}</p>
              </div>
            )}
            {collateral.location && (
              <div>
                <p className="text-sm text-slate-500">Location</p>
                <p className="font-semibold flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  {collateral.location}
                </p>
              </div>
            )}
            {collateral.condition && (
              <div>
                <p className="text-sm text-slate-500">Condition</p>
                <p className="font-semibold capitalize">{collateral.condition}</p>
              </div>
            )}
            {collateral.serialNumber && (
              <div>
                <p className="text-sm text-slate-500">Serial Number</p>
                <p className="font-mono text-sm">{collateral.serialNumber}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Photos */}
      {photos.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ImageIcon className="w-5 h-5" />
              Collateral Photos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {photos.map((photo: string, index: number) => (
                <div key={index} className="relative aspect-square rounded-lg overflow-hidden border border-slate-200">
                  <img
                    src={photo}
                    alt={`Collateral photo ${index + 1}`}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'https://via.placeholder.com/300?text=Image+Not+Available';
                    }}
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Documents */}
      {collateral.documents && collateral.documents.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Related Documents
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {collateral.documents.map((doc: any, index: number) => (
                <div key={index} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <FileText className="w-5 h-5 text-slate-400" />
                    <div>
                      <p className="font-medium">{doc.name || `Document ${index + 1}`}</p>
                      <p className="text-xs text-slate-500">{doc.type || 'Document'}</p>
                    </div>
                  </div>
                  {doc.url && (
                    <a href={doc.url} target="_blank" rel="noopener noreferrer">
                      <Button variant="outline" size="sm">View</Button>
                    </a>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Verification Notes */}
      {collateral.verificationNotes && (
        <Card>
          <CardHeader>
            <CardTitle>Verification Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-slate-700 whitespace-pre-wrap">{collateral.verificationNotes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

