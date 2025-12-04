import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase/client';
import { useAuth } from '../../../hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { Calendar as CalendarIcon, Clock, MapPin, User, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { formatDateSafe } from '../../../lib/utils';;
import { startOfMonth, endOfMonth, eachDayOfInterval, format, isSameDay, isToday } from 'date-fns';

export function CalendarPage() {
  const { profile } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const { data: tasks } = useQuery({
    queryKey: ['calendar-tasks', profile?.agency_id, monthStart, monthEnd],
    queryFn: async () => {
      if (!profile?.agency_id) return [];

      const { data, error } = await supabase
        .from('tasks')
        .select('*, related_loan:loans(loan_number)')
        .eq('agency_id', profile.agency_id)
        .gte('due_date', monthStart.toISOString())
        .lte('due_date', monthEnd.toISOString())
        .order('due_date', { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.agency_id,
  });

  const { data: repayments } = useQuery({
    queryKey: ['calendar-repayments', profile?.agency_id, monthStart, monthEnd],
    queryFn: async () => {
      if (!profile?.agency_id) return [];

      const { data, error } = await supabase
        .from('repayments')
        .select('*, loans!inner(loan_number, customer_id, customers(users(full_name)))')
        .eq('loans.agency_id', profile.agency_id)
        .eq('status', 'pending')
        .gte('due_date', monthStart.toISOString())
        .lte('due_date', monthEnd.toISOString())
        .order('due_date', { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.agency_id,
  });

  const getEventsForDate = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const dayTasks = tasks?.filter((task: any) =>
      isSameDay(new Date(task.due_date), date)
    ) || [];
    const dayRepayments = repayments?.filter((repayment: any) =>
      isSameDay(new Date(repayment.due_date), date)
    ) || [];
    return { tasks: dayTasks, repayments: dayRepayments };
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentDate((prev) => {
      const newDate = new Date(prev);
      if (direction === 'prev') {
        newDate.setMonth(prev.getMonth() - 1);
      } else {
        newDate.setMonth(prev.getMonth() + 1);
      }
      return newDate;
    });
  };

  const selectedDateEvents = selectedDate ? getEventsForDate(selectedDate) : null;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Calendar</h2>
          <p className="text-slate-600">View tasks, payments, and scheduled events</p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          New Event
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>{format(currentDate, 'MMMM yyyy')}</CardTitle>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => navigateMonth('prev')}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button size="sm" variant="outline" onClick={() => setCurrentDate(new Date())}>
                  Today
                </Button>
                <Button size="sm" variant="outline" onClick={() => navigateMonth('next')}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-1 mb-4">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                <div key={day} className="text-center text-sm font-medium text-slate-600 py-2">
                  {day}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {daysInMonth.map((day) => {
                const events = getEventsForDate(day);
                const hasEvents = events.tasks.length > 0 || events.repayments.length > 0;
                const isSelected = selectedDate && isSameDay(day, selectedDate);

                return (
                  <button
                    key={day.toISOString()}
                    onClick={() => setSelectedDate(day)}
                    className={`aspect-square p-2 border rounded-lg text-sm transition-colors ${
                      isToday(day)
                        ? 'bg-primary-100 border-primary-600 text-primary-900 font-semibold'
                        : isSelected
                        ? 'bg-primary-50 border-primary-300'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="text-left">
                      <div>{format(day, 'd')}</div>
                      {hasEvents && (
                        <div className="flex gap-1 mt-1">
                          {events.tasks.length > 0 && (
                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                          )}
                          {events.repayments.length > 0 && (
                            <div className="w-1.5 h-1.5 rounded-full bg-amber-500"></div>
                          )}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Events List */}
        <Card>
          <CardHeader>
            <CardTitle>
              {selectedDate ? format(selectedDate, 'MMMM d, yyyy') : 'Select a date'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {selectedDate && selectedDateEvents ? (
              <div className="space-y-4">
                {selectedDateEvents.tasks.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-slate-700 mb-2">Tasks</h3>
                    <div className="space-y-2">
                      {selectedDateEvents.tasks.map((task: any) => (
                        <div
                          key={task.id}
                          className="p-3 bg-blue-50 border border-blue-200 rounded-lg"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <p className="font-medium text-sm text-slate-900">{task.title}</p>
                              <p className="text-xs text-slate-600 mt-1">{task.description}</p>
                            </div>
                            <Badge variant="outline" className="text-xs">
                              {task.priority}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {selectedDateEvents.repayments.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-slate-700 mb-2">Due Payments</h3>
                    <div className="space-y-2">
                      {selectedDateEvents.repayments.map((repayment: any) => (
                        <div
                          key={repayment.id}
                          className="p-3 bg-amber-50 border border-amber-200 rounded-lg"
                        >
                          <p className="font-medium text-sm text-slate-900">
                            {repayment.loans?.loan_number}
                          </p>
                          <p className="text-xs text-slate-600 mt-1">
                            {repayment.loans?.customers?.users?.full_name}
                          </p>
                          <p className="text-xs font-semibold text-amber-700 mt-1">
                            Amount: {repayment.amount} {repayment.loans?.currency}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {selectedDateEvents.tasks.length === 0 &&
                  selectedDateEvents.repayments.length === 0 && (
                    <div className="text-center py-8 text-slate-500">
                      <CalendarIcon className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                      <p>No events scheduled for this date</p>
                    </div>
                  )}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-500">
                <CalendarIcon className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                <p>Select a date to view events</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

