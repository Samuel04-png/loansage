import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { collection, getDocs, doc, addDoc, updateDoc, query as firestoreQuery, where, orderBy, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../lib/firebase/config';
import { useAuth } from '../../../hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Textarea } from '../../../components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../../components/ui/tabs';
import { Badge } from '../../../components/ui/badge';
import { Checkbox } from '../../../components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../components/ui/dialog';
import {
  Shield,
  FileText,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Download,
  Upload,
  Plus,
  Loader2,
  Calendar,
  FileCheck,
  Lock,
  Eye,
} from 'lucide-react';
import { formatDateSafe, formatDateTime } from '../../../lib/utils';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';

interface ComplianceChecklist {
  id: string;
  name: string;
  category: string;
  description: string;
  required: boolean;
  status: 'pending' | 'completed' | 'overdue';
  dueDate?: Date;
  completedAt?: Date;
  completedBy?: string;
  notes?: string;
}

interface RegulatoryReport {
  id: string;
  name: string;
  type: string;
  period: string;
  status: 'draft' | 'submitted' | 'approved';
  submittedAt?: Date;
  dueDate?: Date;
  data: Record<string, any>;
}

export function CompliancePage() {
  const { profile, user } = useAuth();
  const queryClient = useQueryClient();
  const [checklistDialogOpen, setChecklistDialogOpen] = useState(false);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [newChecklistItem, setNewChecklistItem] = useState({
    name: '',
    category: 'general',
    description: '',
    required: true,
    dueDate: '',
  });

  // Default compliance checklist items
  const defaultChecklist: ComplianceChecklist[] = [
    {
      id: '1',
      name: 'Customer KYC Verification',
      category: 'kyc',
      description: 'Verify customer identity documents (NRC, ID)',
      required: true,
      status: 'pending',
    },
    {
      id: '2',
      name: 'Loan Agreement Signed',
      category: 'documentation',
      description: 'Ensure loan agreement is signed by customer',
      required: true,
      status: 'pending',
    },
    {
      id: '3',
      name: 'Collateral Documentation',
      category: 'documentation',
      description: 'Verify collateral ownership and valuation documents',
      required: true,
      status: 'pending',
    },
    {
      id: '4',
      name: 'Credit Check Completed',
      category: 'risk',
      description: 'Perform credit check and risk assessment',
      required: true,
      status: 'pending',
    },
    {
      id: '5',
      name: 'Regulatory Reporting',
      category: 'reporting',
      description: 'Submit monthly regulatory reports',
      required: true,
      status: 'pending',
    },
  ];

  const [checklistItems, setChecklistItems] = useState<ComplianceChecklist[]>(defaultChecklist);

  // Fetch audit logs for compliance
  const { data: auditLogs } = useQuery({
    queryKey: ['compliance-audit-logs', profile?.agency_id],
    queryFn: async () => {
      if (!profile?.agency_id) return [];
      const logsRef = collection(db, 'agencies', profile.agency_id, 'audit_logs');
      const q = firestoreQuery(logsRef, orderBy('timestamp', 'desc'), where('action', 'in', [
        'loan_created',
        'loan_updated',
        'loan_deleted',
        'payment_recorded',
        'status_changed',
      ]));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    },
    enabled: !!profile?.agency_id,
  });

  // Regulatory report templates
  const reportTemplates: RegulatoryReport[] = [
    {
      id: 'monthly-loan-report',
      name: 'Monthly Loan Portfolio Report',
      type: 'portfolio',
      period: 'monthly',
      status: 'draft',
      data: {},
    },
    {
      id: 'default-report',
      name: 'Default Rate Report',
      type: 'defaults',
      period: 'quarterly',
      status: 'draft',
      data: {},
    },
    {
      id: 'customer-report',
      name: 'Customer Data Report',
      type: 'customers',
      period: 'annual',
      status: 'draft',
      data: {},
    },
  ];

  const toggleChecklistItem = (id: string) => {
    setChecklistItems(items =>
      items.map(item =>
        item.id === id
          ? {
              ...item,
              status: item.status === 'completed' ? 'pending' : 'completed',
              completedAt: item.status === 'completed' ? undefined : new Date(),
              completedBy: item.status === 'completed' ? undefined : user?.id,
            }
          : item
      )
    );
    toast.success('Checklist item updated');
  };

  const addChecklistItem = () => {
    const newItem: ComplianceChecklist = {
      id: `item-${Date.now()}`,
      name: newChecklistItem.name,
      category: newChecklistItem.category,
      description: newChecklistItem.description,
      required: newChecklistItem.required,
      status: 'pending',
      dueDate: newChecklistItem.dueDate ? new Date(newChecklistItem.dueDate) : undefined,
    };
    setChecklistItems([...checklistItems, newItem]);
    setChecklistDialogOpen(false);
    setNewChecklistItem({ name: '', category: 'general', description: '', required: true, dueDate: '' });
    toast.success('Checklist item added');
  };

  const generateReport = async (template: RegulatoryReport) => {
    try {
      // Generate report data based on template type
      let reportData: Record<string, any> = {};

      if (template.type === 'portfolio') {
        const loansRef = collection(db, 'agencies', profile!.agency_id, 'loans');
        const loansSnapshot = await getDocs(loansRef);
        const loans = loansSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).filter((l: any) => !l.deleted);

        reportData = {
          totalLoans: loans.length,
          activeLoans: loans.filter((l: any) => l.status === 'active').length,
          totalPortfolioValue: loans.reduce((sum: number, l: any) => sum + Number(l.amount || 0), 0),
          averageLoanAmount: loans.length > 0
            ? loans.reduce((sum: number, l: any) => sum + Number(l.amount || 0), 0) / loans.length
            : 0,
          defaultRate: loans.length > 0
            ? (loans.filter((l: any) => l.status === 'defaulted').length / loans.length) * 100
            : 0,
        };
      }

      // Create report document
      const reportRef = collection(db, 'agencies', profile!.agency_id, 'regulatory_reports');
      await addDoc(reportRef, {
        ...template,
        data: reportData,
        generatedAt: serverTimestamp(),
        generatedBy: user?.id,
        status: 'draft',
      });

      toast.success('Report generated successfully');
    } catch (error: any) {
      toast.error(error.message || 'Failed to generate report');
    }
  };

  const filteredChecklist = selectedCategory === 'all'
    ? checklistItems
    : checklistItems.filter(item => item.category === selectedCategory);

  const complianceStats = {
    total: checklistItems.length,
    completed: checklistItems.filter(item => item.status === 'completed').length,
    pending: checklistItems.filter(item => item.status === 'pending').length,
    overdue: checklistItems.filter(item => item.status === 'overdue').length,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-neutral-900 flex items-center gap-3">
          <Shield className="w-8 h-8 text-[#006BFF]" />
          Compliance & Regulatory
        </h1>
        <p className="text-neutral-600 mt-2">Manage compliance checklists, regulatory reports, and audit trails</p>
      </div>

      {/* Compliance Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-neutral-600">Total Items</p>
                <p className="text-2xl font-bold text-neutral-900">{complianceStats.total}</p>
              </div>
              <FileCheck className="w-8 h-8 text-neutral-400" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-neutral-600">Completed</p>
                <p className="text-2xl font-bold text-green-600">{complianceStats.completed}</p>
              </div>
              <CheckCircle2 className="w-8 h-8 text-green-400" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-neutral-600">Pending</p>
                <p className="text-2xl font-bold text-yellow-600">{complianceStats.pending}</p>
              </div>
              <Clock className="w-8 h-8 text-yellow-400" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-neutral-600">Overdue</p>
                <p className="text-2xl font-bold text-red-600">{complianceStats.overdue}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-red-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="checklist" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="checklist">Compliance Checklist</TabsTrigger>
          <TabsTrigger value="reports">Regulatory Reports</TabsTrigger>
          <TabsTrigger value="audit">Audit Trail</TabsTrigger>
          <TabsTrigger value="policies">Data Policies</TabsTrigger>
        </TabsList>

        {/* Compliance Checklist */}
        <TabsContent value="checklist" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Compliance Checklist</CardTitle>
                  <CardDescription>Track required compliance items and documentation</CardDescription>
                </div>
                <div className="flex gap-2">
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="all">All Categories</option>
                    <option value="kyc">KYC</option>
                    <option value="documentation">Documentation</option>
                    <option value="risk">Risk Management</option>
                    <option value="reporting">Reporting</option>
                    <option value="general">General</option>
                  </select>
                  <Button onClick={() => setChecklistDialogOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Item
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12"></TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Completed</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredChecklist.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <Checkbox
                          checked={item.status === 'completed'}
                          onCheckedChange={() => toggleChecklistItem(item.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-semibold">{item.name}</p>
                          <p className="text-xs text-neutral-500">{item.description}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{item.category}</Badge>
                      </TableCell>
                      <TableCell>
                        {item.status === 'completed' ? (
                          <Badge className="bg-green-100 text-green-700 border-green-200">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Completed
                          </Badge>
                        ) : item.status === 'overdue' ? (
                          <Badge className="bg-red-100 text-red-700 border-red-200">
                            <AlertTriangle className="w-3 h-3 mr-1" />
                            Overdue
                          </Badge>
                        ) : (
                          <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200">
                            <Clock className="w-3 h-3 mr-1" />
                            Pending
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {item.dueDate ? formatDateSafe(item.dueDate) : 'N/A'}
                      </TableCell>
                      <TableCell>
                        {item.completedAt ? formatDateTime(item.completedAt) : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Regulatory Reports */}
        <TabsContent value="reports" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Regulatory Reports</CardTitle>
              <CardDescription>Generate and submit regulatory reports</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {reportTemplates.map((template) => (
                  <div key={template.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <FileText className="w-5 h-5 text-[#006BFF]" />
                        <div>
                          <p className="font-semibold">{template.name}</p>
                          <p className="text-sm text-neutral-500">
                            {template.type} • {template.period}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{template.status}</Badge>
                      <Button
                        variant="outline"
                        onClick={() => generateReport(template)}
                      >
                        <Download className="mr-2 h-4 w-4" />
                        Generate
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Report Templates */}
          <Card>
            <CardHeader>
              <CardTitle>Report Templates</CardTitle>
              <CardDescription>Pre-configured regulatory report templates</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 border rounded-lg">
                  <h4 className="font-semibold mb-2">Monthly Portfolio Report</h4>
                  <p className="text-sm text-neutral-600 mb-4">
                    Summary of loan portfolio, disbursements, and collections
                  </p>
                  <Button variant="outline" size="sm">
                    <Download className="mr-2 h-4 w-4" />
                    Download Template
                  </Button>
                </div>
                <div className="p-4 border rounded-lg">
                  <h4 className="font-semibold mb-2">Default Rate Report</h4>
                  <p className="text-sm text-neutral-600 mb-4">
                    Analysis of default rates and at-risk loans
                  </p>
                  <Button variant="outline" size="sm">
                    <Download className="mr-2 h-4 w-4" />
                    Download Template
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Audit Trail */}
        <TabsContent value="audit" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Audit Trail</CardTitle>
              <CardDescription>Complete history of all system actions for compliance</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Action</TableHead>
                    <TableHead>Entity</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {auditLogs?.slice(0, 50).map((log: any) => (
                    <TableRow key={log.id}>
                      <TableCell>
                        <Badge variant="outline">{log.action || 'N/A'}</Badge>
                      </TableCell>
                      <TableCell>{log.targetCollection || 'N/A'}</TableCell>
                      <TableCell>{log.actorId || 'System'}</TableCell>
                      <TableCell>{formatDateTime(log.timestamp)}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm">
                          <Eye className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Data Policies */}
        <TabsContent value="policies" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Data Retention Policies</CardTitle>
              <CardDescription>Configure data retention and deletion policies</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h4 className="font-semibold text-blue-900 mb-2">Current Policy</h4>
                <p className="text-sm text-blue-800">
                  Customer data: Retained for 7 years after account closure
                </p>
                <p className="text-sm text-blue-800">
                  Loan records: Retained indefinitely for regulatory compliance
                </p>
                <p className="text-sm text-blue-800">
                  Audit logs: Retained for 10 years
                </p>
              </div>

              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <h4 className="font-semibold text-yellow-900 mb-2">GDPR Compliance</h4>
                <p className="text-sm text-yellow-800">
                  Users can request data export or deletion. All requests are logged in the audit trail.
                </p>
              </div>

              <div className="flex gap-2">
                <Button variant="outline">
                  <Download className="mr-2 h-4 w-4" />
                  Export All Data
                </Button>
                <Button variant="outline" className="text-red-600 hover:text-red-700">
                  <Lock className="mr-2 h-4 w-4" />
                  Configure Retention
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Checklist Item Dialog */}
      <Dialog open={checklistDialogOpen} onOpenChange={setChecklistDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Compliance Checklist Item</DialogTitle>
            <DialogDescription>Add a new item to the compliance checklist</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Item Name</Label>
              <Input
                value={newChecklistItem.name}
                onChange={(e) => setNewChecklistItem({ ...newChecklistItem, name: e.target.value })}
                placeholder="e.g., Customer KYC Verification"
                className="mt-2"
              />
            </div>
            <div>
              <Label>Category</Label>
              <select
                value={newChecklistItem.category}
                onChange={(e) => setNewChecklistItem({ ...newChecklistItem, category: e.target.value })}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-2"
              >
                <option value="general">General</option>
                <option value="kyc">KYC</option>
                <option value="documentation">Documentation</option>
                <option value="risk">Risk Management</option>
                <option value="reporting">Reporting</option>
              </select>
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={newChecklistItem.description}
                onChange={(e) => setNewChecklistItem({ ...newChecklistItem, description: e.target.value })}
                placeholder="Describe the compliance requirement..."
                rows={3}
                className="mt-2"
              />
            </div>
            <div>
              <Label>Due Date (Optional)</Label>
              <Input
                type="date"
                value={newChecklistItem.dueDate}
                onChange={(e) => setNewChecklistItem({ ...newChecklistItem, dueDate: e.target.value })}
                className="mt-2"
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                checked={newChecklistItem.required}
                onCheckedChange={(checked) => setNewChecklistItem({ ...newChecklistItem, required: checked as boolean })}
              />
              <Label>Required for compliance</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChecklistDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={addChecklistItem}
              disabled={!newChecklistItem.name.trim()}
            >
              Add Item
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

