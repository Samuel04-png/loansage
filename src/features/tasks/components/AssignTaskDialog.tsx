import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { collection, getDocs, query as firestoreQuery, where, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase/config';
import { useAuth } from '../../../hooks/useAuth';
import { useAgency } from '../../../hooks/useAgency';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../components/ui/dialog';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Textarea } from '../../../components/ui/textarea';
import toast from 'react-hot-toast';
import { Loader2 } from 'lucide-react';

interface AssignTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AssignTaskDialog({ open, onOpenChange }: AssignTaskDialogProps) {
  const { profile, user } = useAuth();
  const { agency } = useAgency();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    assignedTo: '',
    type: 'follow_up',
    priority: 'medium',
    dueDate: '',
    relatedLoanId: '',
  });

  // Get all employees for assignment
  const { data: employees, isLoading: loadingEmployees } = useQuery({
    queryKey: ['employees', profile?.agency_id],
    queryFn: async () => {
      if (!profile?.agency_id) return [];

      const employeesRef = collection(db, 'agencies', profile.agency_id, 'employees');
      const snapshot = await getDocs(employeesRef);
      
      // Fetch user details for each employee
      const employeesWithUsers = await Promise.all(
        snapshot.docs.map(async (empDoc) => {
          const empData = empDoc.data();
          if (empData.userId) {
            try {
              const userDoc = await getDoc(doc(db, 'users', empData.userId));
              return {
                id: empDoc.id,
                ...empData,
                userName: userDoc.exists() ? userDoc.data().full_name : empData.name || 'Unknown',
                userEmail: userDoc.exists() ? userDoc.data().email : empData.email || '',
              };
            } catch (error) {
              return {
                id: empDoc.id,
                ...empData,
                userName: empData.name || 'Unknown',
                userEmail: empData.email || '',
              };
            }
          }
          return {
            id: empDoc.id,
            ...empData,
            userName: empData.name || 'Unknown',
            userEmail: empData.email || '',
          };
        })
      );

      return employeesWithUsers;
    },
    enabled: !!profile?.agency_id && open,
  });

  // Get loans for linking
  const { data: loans } = useQuery({
    queryKey: ['loans-for-tasks', profile?.agency_id],
    queryFn: async () => {
      if (!profile?.agency_id) return [];

      const loansRef = collection(db, 'agencies', profile.agency_id, 'loans');
      const snapshot = await getDocs(loansRef);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        loanNumber: doc.data().loanNumber || doc.id.substring(0, 8),
      }));
    },
    enabled: !!profile?.agency_id && open,
  });

  const assignTask = useMutation({
    mutationFn: async () => {
      if (!profile?.agency_id || !user?.id) throw new Error('Missing required data');
      if (!formData.title.trim()) throw new Error('Title is required');
      if (!formData.assignedTo) throw new Error('Please select an employee');

      // Get assigned employee details
      const assignedEmployee = employees?.find((e: any) => e.id === formData.assignedTo);
      if (!assignedEmployee) throw new Error('Selected employee not found');

      // Get assigned by employee ID
      const assignedByEmployee = employees?.find((e: any) => e.userId === user.id);
      if (!assignedByEmployee) throw new Error('Your employee record not found');

      const taskData = {
        title: formData.title.trim(),
        description: formData.description.trim() || '',
        assignedTo: formData.assignedTo,
        assignedToUserId: assignedEmployee.userId,
        assignedToName: assignedEmployee.userName,
        assignedBy: assignedByEmployee.id,
        assignedByUserId: user.id,
        assignedByName: profile.full_name || 'Admin',
        type: formData.type,
        priority: formData.priority,
        status: 'pending',
        dueDate: formData.dueDate ? new Date(formData.dueDate) : null,
        relatedLoanId: formData.relatedLoanId || null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const tasksRef = collection(db, 'agencies', profile.agency_id, 'tasks');
      const taskDocRef = await addDoc(tasksRef, taskData);

      // Create notification for assigned employee
      try {
        const notificationsRef = collection(db, 'agencies', profile.agency_id, 'notifications');
        await addDoc(notificationsRef, {
          userId: assignedEmployee.userId,
          type: 'task_assigned',
          title: 'New Task Assigned',
          message: `You have been assigned a new task: ${formData.title}`,
          metadata: {
            taskId: taskDocRef.id,
            assignedBy: profile.full_name,
          },
          read: false,
          createdAt: serverTimestamp(),
        });
      } catch (error) {
        console.warn('Failed to create notification:', error);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['all-tasks'] });
      toast.success('Task assigned successfully');
      setFormData({
        title: '',
        description: '',
        assignedTo: '',
        type: 'follow_up',
        priority: 'medium',
        dueDate: '',
        relatedLoanId: '',
      });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to assign task');
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Assign New Task</DialogTitle>
          <DialogDescription>
            Create and assign a task to an employee
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="title">Task Title *</Label>
            <Input
              id="title"
              placeholder="e.g., Follow up with customer on payment"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Add details about the task..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={4}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="assignedTo">Assign To *</Label>
              {loadingEmployees ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm text-muted-foreground">Loading employees...</span>
                </div>
              ) : (
                <select
                  id="assignedTo"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={formData.assignedTo}
                  onChange={(e) => setFormData({ ...formData, assignedTo: e.target.value })}
                >
                  <option value="">Select employee...</option>
                  {employees?.map((emp: any) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.userName} {emp.userEmail ? `(${emp.userEmail})` : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">Task Type</Label>
              <select
                id="type"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              >
                <option value="follow_up">Follow Up</option>
                <option value="field_visit">Field Visit</option>
                <option value="collection">Collection</option>
                <option value="call">Phone Call</option>
                <option value="documentation">Documentation</option>
                <option value="review">Review</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <select
                id="priority"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="dueDate">Due Date</Label>
              <Input
                id="dueDate"
                type="datetime-local"
                value={formData.dueDate}
                onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="relatedLoanId">Related Loan (Optional)</Label>
            <select
              id="relatedLoanId"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={formData.relatedLoanId}
              onChange={(e) => setFormData({ ...formData, relatedLoanId: e.target.value })}
            >
              <option value="">No related loan</option>
              {loans?.slice(0, 50).map((loan: any) => (
                <option key={loan.id} value={loan.id}>
                  {loan.loanNumber} - {loan.amount ? `ZMW ${loan.amount.toLocaleString()}` : 'N/A'}
                </option>
              ))}
            </select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => assignTask.mutate()}
            disabled={assignTask.isPending || !formData.title.trim() || !formData.assignedTo}
          >
            {assignTask.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Assigning...
              </>
            ) : (
              'Assign Task'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
