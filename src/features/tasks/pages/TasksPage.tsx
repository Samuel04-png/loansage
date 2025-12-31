import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { collection, getDocs, query as firestoreQuery, where, orderBy, updateDoc, doc, serverTimestamp, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '../../../lib/firebase/config';
import { useAuth } from '../../../hooks/useAuth';
import { useAgency } from '../../../hooks/useAgency';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Badge } from '../../../components/ui/badge';
import { Plus, Search, CheckCircle2, Clock, AlertCircle, Loader2, User, FileText } from 'lucide-react';
import { formatDateSafe } from '../../../lib/utils';
import toast from 'react-hot-toast';
import { AssignTaskDialog } from '../components/AssignTaskDialog';
import { Link } from 'react-router-dom';

export function TasksPage() {
  const { profile, user } = useAuth();
  const { agency } = useAgency();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);

  // Check if user can assign tasks (Admin or Manager)
  const canAssignTasks = profile?.role === 'admin' || profile?.employee_category === 'manager';

  // Get employee by user ID
  const { data: employee } = useQuery({
    queryKey: ['employee-by-user', user?.id, profile?.agency_id],
    queryFn: async () => {
      if (!user?.id || !profile?.agency_id) return null;

      const employeesRef = collection(db, 'agencies', profile.agency_id, 'employees');
      const q = firestoreQuery(employeesRef, where('userId', '==', user.id));
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) return null;
      return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
    },
    enabled: !!user?.id && !!profile?.agency_id,
  });

  // Get tasks assigned to this employee
  const { data: tasks, isLoading } = useQuery({
    queryKey: ['tasks', employee?.id, profile?.agency_id, statusFilter, priorityFilter],
    queryFn: async () => {
      if (!employee?.id || !profile?.agency_id) return [];

      const tasksRef = collection(db, 'agencies', profile.agency_id, 'tasks');
      let q = firestoreQuery(
        tasksRef,
        where('assignedTo', '==', employee.id),
        orderBy('createdAt', 'desc')
      );

      if (statusFilter !== 'all') {
        q = firestoreQuery(
          tasksRef,
          where('assignedTo', '==', employee.id),
          where('status', '==', statusFilter),
          orderBy('createdAt', 'desc')
        );
      }

      if (priorityFilter !== 'all') {
        // Note: Firestore doesn't support multiple where clauses easily, so we filter in memory
        const snapshot = await getDocs(q);
        const tasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        return tasks.filter((t: any) => t.priority === priorityFilter);
      }

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate?.() || data.createdAt,
          dueDate: data.dueDate?.toDate?.() || data.dueDate,
        };
      });
    },
    enabled: !!employee?.id && !!profile?.agency_id,
  });

  // Get all tasks (for admins/managers)
  const { data: allTasks } = useQuery({
    queryKey: ['all-tasks', profile?.agency_id],
    queryFn: async () => {
      if (!profile?.agency_id || !canAssignTasks) return [];

      const tasksRef = collection(db, 'agencies', profile.agency_id, 'tasks');
      const q = firestoreQuery(tasksRef, orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate?.() || data.createdAt,
          dueDate: data.dueDate?.toDate?.() || data.dueDate,
        };
      });
    },
    enabled: !!profile?.agency_id && canAssignTasks,
  });

  const updateTaskStatus = useMutation({
    mutationFn: async ({ taskId, status }: { taskId: string; status: string }) => {
      if (!profile?.agency_id) throw new Error('No agency ID');

      const taskRef = doc(db, 'agencies', profile.agency_id, 'tasks', taskId);
      await updateDoc(taskRef, {
        status,
        updatedAt: serverTimestamp(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['all-tasks'] });
      toast.success('Task updated');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update task');
    },
  });

  const filteredTasks = (canAssignTasks && allTasks ? allTasks : tasks)?.filter((task: any) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      task.title?.toLowerCase().includes(search) ||
      task.description?.toLowerCase().includes(search) ||
      task.type?.toLowerCase().includes(search)
    );
  }) || [];

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return <Badge variant="destructive" className="text-xs">Urgent</Badge>;
      case 'high':
        return <Badge className="bg-orange-500 text-white text-xs">High</Badge>;
      case 'medium':
        return <Badge variant="default" className="text-xs">Medium</Badge>;
      case 'low':
        return <Badge variant="secondary" className="text-xs">Low</Badge>;
      default:
        return <Badge variant="outline" className="text-xs">{priority}</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-500 text-white text-xs">Completed</Badge>;
      case 'in_progress':
        return <Badge variant="default" className="text-xs">In Progress</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-500 text-white text-xs">Pending</Badge>;
      case 'cancelled':
        return <Badge variant="destructive" className="text-xs">Cancelled</Badge>;
      default:
        return <Badge variant="outline" className="text-xs">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-neutral-100">Tasks</h2>
          <p className="text-slate-600 dark:text-neutral-400">
            {canAssignTasks ? 'Manage and assign tasks' : 'Manage your assigned tasks'}
          </p>
        </div>
        {canAssignTasks && (
          <Button onClick={() => setAssignDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Assign Task
          </Button>
        )}
      </div>

      <Card>
        <CardHeader className="p-4 border-b border-slate-100 dark:border-neutral-700">
          <div className="flex gap-4 flex-wrap">
            <div className="relative flex-1 max-w-md">
              <Input
                placeholder="Search tasks..."
                className="pl-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
            </div>
            <select
              className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <select
              className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
            >
              <option value="all">All Priority</option>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
            </div>
          ) : filteredTasks.length > 0 ? (
            <div className="divide-y divide-slate-100 dark:divide-neutral-700">
              {filteredTasks.map((task: any) => (
                <div
                  key={task.id}
                  className="p-4 hover:bg-slate-50 dark:hover:bg-neutral-800/50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2 flex-wrap">
                        <h3 className="font-semibold text-slate-900 dark:text-neutral-100">{task.title}</h3>
                        {getPriorityBadge(task.priority)}
                        {getStatusBadge(task.status)}
                        {task.type && (
                          <Badge variant="outline" className="text-xs capitalize">{task.type}</Badge>
                        )}
                      </div>
                      {task.description && (
                        <p className="text-sm text-slate-600 dark:text-neutral-400 mb-2">{task.description}</p>
                      )}
                      <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-neutral-500 flex-wrap">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Due: {task.dueDate ? formatDateSafe(task.dueDate) : 'No due date'}
                        </span>
                        {task.relatedLoanId && (
                          <Link
                            to={`/employee/loans/${task.relatedLoanId}`}
                            className="flex items-center gap-1 text-primary-600 hover:underline"
                          >
                            <FileText className="w-3 h-3" />
                            View Loan
                          </Link>
                        )}
                        {task.assignedBy && (
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            Assigned by: {task.assignedByName || 'Unknown'}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 ml-4">
                      {task.status !== 'completed' && task.status !== 'cancelled' && (
                        <>
                          {task.status === 'pending' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                updateTaskStatus.mutate({ taskId: task.id, status: 'in_progress' })
                              }
                            >
                              Start
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              updateTaskStatus.mutate({ taskId: task.id, status: 'completed' })
                            }
                          >
                            <CheckCircle2 className="w-4 h-4 mr-1" />
                            Complete
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-slate-500 dark:text-neutral-400">
              <AlertCircle className="w-12 h-12 mx-auto mb-4 text-slate-300 dark:text-neutral-600" />
              <p>No tasks found</p>
              {canAssignTasks && (
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => setAssignDialogOpen(true)}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Assign Your First Task
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {canAssignTasks && (
        <AssignTaskDialog
          open={assignDialogOpen}
          onOpenChange={setAssignDialogOpen}
        />
      )}
    </div>
  );
}
