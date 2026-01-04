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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../../components/ui/dropdown-menu';
import {
  Users,
  MessageSquare,
  Calendar,
  TrendingUp,
  Star,
  Mail,
  Phone,
  Clock,
  Plus,
  Loader2,
  Filter,
  Target,
  BarChart3,
  UserCheck,
  UserX,
  AlertCircle,
  MoreVertical,
  Eye,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatDateSafe, formatDateTime } from '../../../lib/utils';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import { formatCurrency } from '../../../lib/utils';

export function CRMPage() {
  const { profile, user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedSegment, setSelectedSegment] = useState<string>('all');
  const [interactionDialogOpen, setInteractionDialogOpen] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [interactionType, setInteractionType] = useState<'call' | 'email' | 'meeting' | 'note'>('note');
  const [interactionNotes, setInteractionNotes] = useState('');
  const [campaignDialogOpen, setCampaignDialogOpen] = useState(false);
  const [campaignName, setCampaignName] = useState('');
  const [campaignType, setCampaignType] = useState<'email' | 'sms' | 'promotion'>('email');
  const [campaignMessage, setCampaignMessage] = useState('');

  // Fetch customers
  const { data: customers } = useQuery({
    queryKey: ['customers', profile?.agency_id],
    queryFn: async () => {
      if (!profile?.agency_id) return [];
      const customersRef = collection(db, 'agencies', profile.agency_id, 'customers');
      const snapshot = await getDocs(customersRef);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    },
    enabled: !!profile?.agency_id,
  });

  // Fetch customer interactions
  const { data: interactions } = useQuery({
    queryKey: ['customer-interactions', profile?.agency_id],
    queryFn: async () => {
      if (!profile?.agency_id) return [];
      const interactionsRef = collection(db, 'agencies', profile.agency_id, 'customer_interactions');
      const q = firestoreQuery(interactionsRef, orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    },
    enabled: !!profile?.agency_id,
  });

  // Fetch customer loans for segmentation
  const { data: customerLoans } = useQuery({
    queryKey: ['customer-loans-segmentation', profile?.agency_id],
    queryFn: async () => {
      if (!profile?.agency_id) return [];
      const loansRef = collection(db, 'agencies', profile.agency_id, 'loans');
      const snapshot = await getDocs(loansRef);
      const loans = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Group by customer
      const customerLoanMap: Record<string, any[]> = {};
      loans.forEach((loan: any) => {
        if (loan.customerId && !loan.deleted) {
          if (!customerLoanMap[loan.customerId]) {
            customerLoanMap[loan.customerId] = [];
          }
          customerLoanMap[loan.customerId].push(loan);
        }
      });
      
      return customerLoanMap;
    },
    enabled: !!profile?.agency_id,
  });

  // Calculate customer segments
  const customerSegments = customers && customerLoans ? customers.map((customer: any) => {
    const loans = customerLoans[customer.id] || [];
    const totalBorrowed = loans.reduce((sum: number, loan: any) => sum + Number(loan.amount || 0), 0);
    const activeLoans = loans.filter((l: any) => l.status === 'active').length;
    const defaultedLoans = loans.filter((l: any) => l.status === 'defaulted').length;
    
    let segment = 'bronze';
    if (totalBorrowed > 500000 && defaultedLoans === 0) segment = 'platinum';
    else if (totalBorrowed > 200000 && defaultedLoans === 0) segment = 'gold';
    else if (totalBorrowed > 100000 && defaultedLoans === 0) segment = 'silver';
    else if (defaultedLoans > 0) segment = 'at_risk';
    
    return {
      ...customer,
      segment,
      totalBorrowed,
      activeLoans,
      defaultedLoans,
      loanCount: loans.length,
    };
  }) : [];

  // Filter by segment
  const filteredCustomers = selectedSegment === 'all' 
    ? customerSegments 
    : customerSegments.filter((c: any) => c.segment === selectedSegment);

  // Record interaction
  const recordInteraction = useMutation({
    mutationFn: async () => {
      if (!profile?.agency_id || !selectedCustomerId) throw new Error('Missing data');
      
      const interactionRef = collection(db, 'agencies', profile.agency_id, 'customer_interactions');
      await addDoc(interactionRef, {
        customerId: selectedCustomerId,
        type: interactionType,
        notes: interactionNotes,
        createdBy: user?.id,
        createdAt: serverTimestamp(),
      });
    },
    onSuccess: () => {
      toast.success('Interaction recorded successfully');
      setInteractionDialogOpen(false);
      setInteractionNotes('');
      setSelectedCustomerId(null);
      queryClient.invalidateQueries({ queryKey: ['customer-interactions'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to record interaction');
    },
  });

  // Create campaign
  const createCampaign = useMutation({
    mutationFn: async () => {
      if (!profile?.agency_id) throw new Error('Agency not found');
      
      const campaignRef = collection(db, 'agencies', profile.agency_id, 'marketing_campaigns');
      await addDoc(campaignRef, {
        name: campaignName,
        type: campaignType,
        message: campaignMessage,
        status: 'draft',
        targetSegment: selectedSegment,
        createdBy: user?.id,
        createdAt: serverTimestamp(),
      });
    },
    onSuccess: () => {
      toast.success('Campaign created successfully');
      setCampaignDialogOpen(false);
      setCampaignName('');
      setCampaignMessage('');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to create campaign');
    },
  });

  const getSegmentBadge = (segment: string) => {
    const config: Record<string, { label: string; className: string }> = {
      platinum: { label: 'Platinum', className: 'bg-purple-100 text-purple-700 border-purple-200' },
      gold: { label: 'Gold', className: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
      silver: { label: 'Silver', className: 'bg-gray-100 text-gray-700 border-gray-200' },
      bronze: { label: 'Bronze', className: 'bg-orange-100 text-orange-700 border-orange-200' },
      at_risk: { label: 'At Risk', className: 'bg-red-100 text-red-700 border-red-200' },
    };
    const cfg = config[segment] || config.bronze;
    return <Badge variant="outline" className={cfg.className}>{cfg.label}</Badge>;
  };

  const segmentStats = {
    platinum: customerSegments.filter((c: any) => c.segment === 'platinum').length,
    gold: customerSegments.filter((c: any) => c.segment === 'gold').length,
    silver: customerSegments.filter((c: any) => c.segment === 'silver').length,
    bronze: customerSegments.filter((c: any) => c.segment === 'bronze').length,
    at_risk: customerSegments.filter((c: any) => c.segment === 'at_risk').length,
  };

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <h1 className="page-title text-neutral-900 dark:text-neutral-100 mb-1">Customer Relationship Management</h1>
        <p className="helper-text">Manage customer relationships, interactions, and marketing campaigns</p>
      </motion.div>

      {/* Segment Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-neutral-600">Platinum</p>
                <p className="text-2xl font-bold text-purple-600">{segmentStats.platinum}</p>
              </div>
              <Star className="w-8 h-8 text-purple-400" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-neutral-600">Gold</p>
                <p className="text-2xl font-bold text-yellow-600">{segmentStats.gold}</p>
              </div>
              <Star className="w-8 h-8 text-yellow-400" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-neutral-600">Silver</p>
                <p className="text-2xl font-bold text-gray-600">{segmentStats.silver}</p>
              </div>
              <Star className="w-8 h-8 text-gray-400" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-neutral-600">Bronze</p>
                <p className="text-2xl font-bold text-orange-600">{segmentStats.bronze}</p>
              </div>
              <Star className="w-8 h-8 text-orange-400" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-neutral-600">At Risk</p>
                <p className="text-2xl font-bold text-red-600">{segmentStats.at_risk}</p>
              </div>
              <AlertCircle className="w-8 h-8 text-red-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="customers" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="customers">Customer Segments</TabsTrigger>
          <TabsTrigger value="interactions">Interactions</TabsTrigger>
          <TabsTrigger value="lifecycle">Lifecycle</TabsTrigger>
          <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
        </TabsList>

        {/* Customer Segments */}
        <TabsContent value="customers" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Customer Segments</CardTitle>
                  <CardDescription>Customers automatically segmented by value and risk</CardDescription>
                </div>
                <div className="flex gap-2">
                  <select
                    value={selectedSegment}
                    onChange={(e) => setSelectedSegment(e.target.value)}
                    className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="all">All Segments</option>
                    <option value="platinum">Platinum</option>
                    <option value="gold">Gold</option>
                    <option value="silver">Silver</option>
                    <option value="bronze">Bronze</option>
                    <option value="at_risk">At Risk</option>
                  </select>
                  <Button
                    onClick={() => setInteractionDialogOpen(true)}
                    variant="outline"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Record Interaction
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-b border-neutral-200 dark:border-neutral-800">
                    <TableHead className="font-semibold text-neutral-700 dark:text-neutral-300">Customer</TableHead>
                    <TableHead className="font-semibold text-neutral-700 dark:text-neutral-300">Segment</TableHead>
                    <TableHead className="font-semibold text-neutral-700 dark:text-neutral-300">Total Borrowed</TableHead>
                    <TableHead className="font-semibold text-neutral-700 dark:text-neutral-300">Active Loans</TableHead>
                    <TableHead className="font-semibold text-neutral-700 dark:text-neutral-300">Loan Count</TableHead>
                    <TableHead className="font-semibold text-neutral-700 dark:text-neutral-300 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCustomers.map((customer: any) => (
                    <TableRow key={customer.id}>
                      <TableCell>
                        <div>
                          <p className="font-semibold">{customer.fullName || customer.name || 'N/A'}</p>
                          <p className="text-xs text-neutral-500">{customer.email || customer.phone || ''}</p>
                        </div>
                      </TableCell>
                      <TableCell>{getSegmentBadge(customer.segment)}</TableCell>
                      <TableCell>{formatCurrency(customer.totalBorrowed)}</TableCell>
                      <TableCell>{customer.activeLoans}</TableCell>
                      <TableCell>{customer.loanCount}</TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link to={`/admin/customers/${customer.id}`} className="cursor-pointer">
                                <Eye className="mr-2 h-4 w-4" />
                                View Details
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedCustomerId(customer.id);
                                setInteractionDialogOpen(true);
                              }}
                            >
                              <MessageSquare className="mr-2 h-4 w-4" />
                              Record Interaction
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Interactions */}
        <TabsContent value="interactions" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Customer Interactions</CardTitle>
                  <CardDescription>Track all customer communications and interactions</CardDescription>
                </div>
                <Button onClick={() => setInteractionDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Record Interaction
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>By</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {interactions?.map((interaction: any) => {
                    const customer = customers?.find((c: any) => c.id === interaction.customerId);
                    return (
                      <TableRow key={interaction.id}>
                        <TableCell>
                          <Link to={`/admin/customers/${interaction.customerId}`}>
                            <span className="font-semibold text-[#006BFF] hover:underline">
                              {customer?.fullName || customer?.name || 'Unknown'}
                            </span>
                          </Link>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {interaction.type === 'call' && <Phone className="w-3 h-3 mr-1" />}
                            {interaction.type === 'email' && <Mail className="w-3 h-3 mr-1" />}
                            {interaction.type === 'meeting' && <Calendar className="w-3 h-3 mr-1" />}
                            {interaction.type || 'note'}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-md truncate">{interaction.notes || 'N/A'}</TableCell>
                        <TableCell>{formatDateTime(interaction.createdAt)}</TableCell>
                        <TableCell>{interaction.createdBy || 'System'}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Lifecycle */}
        <TabsContent value="lifecycle" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Customer Lifecycle</CardTitle>
              <CardDescription>Track customer journey from prospect to active borrower</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {customerSegments.map((customer: any) => {
                  const lifecycleStage = customer.loanCount === 0 ? 'Prospect' :
                                        customer.activeLoans > 0 ? 'Active Borrower' :
                                        customer.defaultedLoans > 0 ? 'At Risk' :
                                        'Inactive';
                  
                  return (
                    <div key={customer.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex-1">
                        <p className="font-semibold">{customer.fullName || customer.name || 'N/A'}</p>
                        <p className="text-sm text-neutral-500">{lifecycleStage}</p>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-sm text-neutral-600">Total Loans</p>
                          <p className="font-semibold">{customer.loanCount}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-neutral-600">Total Value</p>
                          <p className="font-semibold">{formatCurrency(customer.totalBorrowed)}</p>
                        </div>
                        <Link to={`/admin/customers/${customer.id}`}>
                          <Button variant="ghost" size="sm">View</Button>
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Campaigns */}
        <TabsContent value="campaigns" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Marketing Campaigns</CardTitle>
                  <CardDescription>Create and manage marketing campaigns for customer segments</CardDescription>
                </div>
                <Button onClick={() => setCampaignDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Campaign
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-neutral-500">
                <Target className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No campaigns yet. Create your first campaign to get started.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Record Interaction Dialog */}
      <Dialog open={interactionDialogOpen} onOpenChange={setInteractionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Customer Interaction</DialogTitle>
            <DialogDescription>Log a call, email, meeting, or note</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Customer</Label>
              <select
                value={selectedCustomerId || ''}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-2"
              >
                <option value="">Select customer</option>
                {customers?.map((customer: any) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.fullName || customer.name || customer.id}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Interaction Type</Label>
              <select
                value={interactionType}
                onChange={(e) => setInteractionType(e.target.value as any)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-2"
              >
                <option value="note">Note</option>
                <option value="call">Phone Call</option>
                <option value="email">Email</option>
                <option value="meeting">Meeting</option>
              </select>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea
                value={interactionNotes}
                onChange={(e) => setInteractionNotes(e.target.value)}
                placeholder="Enter interaction details..."
                rows={4}
                className="mt-2"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInteractionDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => recordInteraction.mutate()}
              disabled={recordInteraction.isPending || !selectedCustomerId || !interactionNotes.trim()}
            >
              {recordInteraction.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Recording...
                </>
              ) : (
                'Record Interaction'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Campaign Dialog */}
      <Dialog open={campaignDialogOpen} onOpenChange={setCampaignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Marketing Campaign</DialogTitle>
            <DialogDescription>Create a targeted campaign for customer segments</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Campaign Name</Label>
              <Input
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
                placeholder="e.g., Q1 Promotion"
                className="mt-2"
              />
            </div>
            <div>
              <Label>Target Segment</Label>
              <select
                value={selectedSegment}
                onChange={(e) => setSelectedSegment(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-2"
              >
                <option value="all">All Customers</option>
                <option value="platinum">Platinum</option>
                <option value="gold">Gold</option>
                <option value="silver">Silver</option>
                <option value="bronze">Bronze</option>
                <option value="at_risk">At Risk</option>
              </select>
            </div>
            <div>
              <Label>Campaign Type</Label>
              <select
                value={campaignType}
                onChange={(e) => setCampaignType(e.target.value as any)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-2"
              >
                <option value="email">Email</option>
                <option value="sms">SMS</option>
                <option value="promotion">Promotion</option>
              </select>
            </div>
            <div>
              <Label>Message</Label>
              <Textarea
                value={campaignMessage}
                onChange={(e) => setCampaignMessage(e.target.value)}
                placeholder="Enter campaign message..."
                rows={4}
                className="mt-2"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCampaignDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createCampaign.mutate()}
              disabled={createCampaign.isPending || !campaignName.trim() || !campaignMessage.trim()}
            >
              {createCampaign.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Campaign'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

