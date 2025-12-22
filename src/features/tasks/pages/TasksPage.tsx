import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase/client';
import { useAuth } from '../../../hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Badge } from '../../../components/ui/badge';
import { Plus, Search, Filter, CheckCircle2, Clock, AlertCircle, Loader2 } from 'lucide-react';
import { formatDateSafe, formatDateTime } from '../../../lib/utils';
import toast from 'react-hot-toast';

export function TasksPage() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');

  // Get employee ID
  const { data: employee } = useQuery({
    queryKey: ['employee', profile?.id],
    queryFn: async () => {
      if (!profile?.id) return null;

      const query = supabase
        .from('employees')
        .select('id')
        .eq('user_id', profile.id)
        .single() as any;

      const { data, error } = await query;

      if (error) throw error;
      return data;
    },
    enabled: !!profile?.id,
  });

  const { data: tasks, isLoading } = useQuery({
    queryKey: ['tasks', employee?.id, statusFilter, priorityFilter],
    queryFn: async () => {
      if (!employee?.id) return [];

      let query = supabase
        .from('tasks')
        .select('*, assigned_by:employees!tasks_assigned_by_id(user_id, users(full_name)), related_loan:loans(loan_number, amount)')
        .eq('assigned_to', employee.id)
        .order('created_at', { ascending: false }) as any;

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      if (priorityFilter !== 'all') {
        query = query.eq('priority', priorityFilter);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data || [];
    },
    enabled: !!employee?.id,
  });

  const updateTaskStatus = useMutation({
    mutationFn: async ({ taskId, status }: { taskId: string; status: string }) => {
      const query = supabase
        .from('tasks')
        .update({ status })
        .eq('id', taskId) as any;

      const { error } = await query;

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Task updated');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update task');
    },
  });

  const filteredTasks = tasks?.filter((task: any) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      task.title?.toLowerCase().includes(search) ||
      task.description?.toLowerCase().includes(search) ||
      task.id?.toLowerCase().includes(search) ||
      task.status?.toLowerCase().includes(search) ||
      task.priority?.toLowerCase().includes(search) ||
      task.assignee?.toLowerCase().includes(search)
    );
  }) || [];

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return <Badge variant="destructive">Urgent</Badge>;
      case 'high':
        return <Badge variant="warning">High</Badge>;
      case 'medium':
        return <Badge variant="default">Medium</Badge>;
      case 'low':
        return <Badge variant="secondary">Low</Badge>;
      default:
        return <Badge variant="outline">{priority}</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="success">Completed</Badge>;
      case 'in_progress':
        return <Badge variant="default">In Progress</Badge>;
      case 'pending':
        return <Badge variant="warning">Pending</Badge>;
      case 'cancelled':
        return <Badge variant="destructive">Cancelled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Tasks</h2>
          <p className="text-slate-600">Manage your assigned tasks</p>
        </div>
        <Button className="flex-shrink-0">
          <Plus className="mr-2 h-4 w-4" />
          New Task
        </Button>
      </div>

      <Card>
        <CardHeader className="p-4 border-b border-slate-100">
          <div className="flex gap-4">
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
            <div className="divide-y">
              {filteredTasks.map((task: any) => (
                <div
                  key={task.id}
                  className="p-4 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold text-slate-900">{task.title}</h3>
                        {getPriorityBadge(task.priority)}
                        {getStatusBadge(task.status)}
                      </div>
                      {task.description && (
                        <p className="text-sm text-slate-600 mb-2">{task.description}</p>
                      )}
                      <div className="flex items-center gap-4 text-xs text-slate-500">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Due: {formatDateSafe(task.due_date) || 'No due date'}
                        </span>
                        {task.related_loan && (
                          <span>Loan: {task.related_loan.loan_number}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 ml-4">
                      {task.status !== 'completed' && (
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
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-slate-500">
              <AlertCircle className="w-12 h-12 mx-auto mb-4 text-slate-300" />
              <p>No tasks found</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

