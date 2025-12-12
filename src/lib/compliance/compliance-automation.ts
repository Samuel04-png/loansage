/**
 * Compliance Automation
 * Automates regulatory compliance tasks and report generation
 * Saves 10+ hours/month
 */

import { collection, addDoc, doc, getDoc, getDocs, query, where, orderBy, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { generateRegulatoryReport, generateTaxReport } from './compliance-reports';

export interface ComplianceTask {
  id: string;
  type: 'regulatory' | 'tax' | 'audit' | 'kpi' | 'custom';
  name: string;
  description: string;
  schedule: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'custom';
  lastRun?: Date;
  nextRun: Date;
  status: 'active' | 'paused' | 'completed';
  autoSubmit: boolean;
  recipients: string[];
}

export interface ComplianceChecklist {
  id: string;
  name: string;
  items: Array<{
    id: string;
    description: string;
    required: boolean;
    completed: boolean;
    completedAt?: Date;
    completedBy?: string;
    notes?: string;
  }>;
  dueDate: Date;
  status: 'pending' | 'in_progress' | 'completed' | 'overdue';
}

/**
 * Generate and schedule compliance reports automatically
 */
export async function scheduleComplianceReports(
  agencyId: string,
  tasks: ComplianceTask[]
): Promise<void> {
  const tasksRef = collection(db, 'agencies', agencyId, 'compliance_tasks');
  
  for (const task of tasks) {
    await addDoc(tasksRef, {
      ...task,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }
}

/**
 * Run scheduled compliance tasks
 */
export async function runScheduledComplianceTasks(agencyId: string): Promise<void> {
  const tasksRef = collection(db, 'agencies', agencyId, 'compliance_tasks');
  const activeTasksQuery = query(tasksRef, where('status', '==', 'active'));
  const tasksSnapshot = await getDocs(activeTasksQuery);
  
  const now = new Date();
  
  for (const taskDoc of tasksSnapshot.docs) {
    const task = { id: taskDoc.id, ...taskDoc.data() } as ComplianceTask;
    const nextRun = task.nextRun?.toDate?.() || new Date(task.nextRun);
    
    // Check if task is due
    if (nextRun <= now) {
      await executeComplianceTask(agencyId, task);
      
      // Update next run date
      const nextRunDate = calculateNextRunDate(task.schedule, now);
      await updateDoc(doc(tasksRef, task.id), {
        lastRun: now,
        nextRun: nextRunDate,
        updatedAt: now,
      });
    }
  }
}

/**
 * Execute a compliance task
 */
async function executeComplianceTask(agencyId: string, task: ComplianceTask): Promise<void> {
  const now = new Date();
  let period: { start: Date; end: Date };
  
  // Calculate period based on schedule
  switch (task.schedule) {
    case 'daily':
      period = {
        start: new Date(now.getTime() - 24 * 60 * 60 * 1000),
        end: now,
      };
      break;
    case 'weekly':
      period = {
        start: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
        end: now,
      };
      break;
    case 'monthly':
      period = {
        start: new Date(now.getFullYear(), now.getMonth() - 1, now.getDate()),
        end: now,
      };
      break;
    case 'quarterly':
      period = {
        start: new Date(now.getFullYear(), now.getMonth() - 3, now.getDate()),
        end: now,
      };
      break;
    case 'yearly':
      period = {
        start: new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()),
        end: now,
      };
      break;
    default:
      period = {
        start: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
        end: now,
      };
  }
  
  try {
    let report;
    
    switch (task.type) {
      case 'regulatory':
        report = await generateRegulatoryReport(agencyId, period);
        break;
      case 'tax':
        report = await generateTaxReport(agencyId, period);
        break;
      default:
        console.warn(`Unknown task type: ${task.type}`);
        return;
    }
    
    // Auto-submit if enabled
    if (task.autoSubmit && task.recipients.length > 0) {
      await submitComplianceReport(agencyId, report.id, task.recipients);
    }
    
    // Log execution
    const executionsRef = collection(db, 'agencies', agencyId, 'compliance_executions');
    await addDoc(executionsRef, {
      taskId: task.id,
      taskName: task.name,
      reportId: report.id,
      executedAt: now,
      status: 'success',
    });
  } catch (error: any) {
    console.error(`Error executing compliance task ${task.id}:`, error);
    
    // Log failure
    const executionsRef = collection(db, 'agencies', agencyId, 'compliance_executions');
    await addDoc(executionsRef, {
      taskId: task.id,
      taskName: task.name,
      executedAt: now,
      status: 'failed',
      error: error.message,
    });
  }
}

/**
 * Submit compliance report to recipients
 */
async function submitComplianceReport(
  agencyId: string,
  reportId: string,
  recipients: string[]
): Promise<void> {
  // In production, this would send emails/notifications
  const submissionsRef = collection(db, 'agencies', agencyId, 'compliance_submissions');
  await addDoc(submissionsRef, {
    reportId,
    recipients,
    submittedAt: new Date(),
    status: 'submitted',
  });
}

/**
 * Calculate next run date based on schedule
 */
function calculateNextRunDate(schedule: ComplianceTask['schedule'], fromDate: Date): Date {
  const next = new Date(fromDate);
  
  switch (schedule) {
    case 'daily':
      next.setDate(next.getDate() + 1);
      break;
    case 'weekly':
      next.setDate(next.getDate() + 7);
      break;
    case 'monthly':
      next.setMonth(next.getMonth() + 1);
      break;
    case 'quarterly':
      next.setMonth(next.getMonth() + 3);
      break;
    case 'yearly':
      next.setFullYear(next.getFullYear() + 1);
      break;
    default:
      next.setDate(next.getDate() + 30);
  }
  
  return next;
}

/**
 * Create compliance checklist
 */
export async function createComplianceChecklist(
  agencyId: string,
  checklist: Omit<ComplianceChecklist, 'id'>
): Promise<ComplianceChecklist> {
  const checklistsRef = collection(db, 'agencies', agencyId, 'compliance_checklists');
  const docRef = await addDoc(checklistsRef, {
    ...checklist,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  
  return {
    id: docRef.id,
    ...checklist,
  };
}

/**
 * Get compliance checklists
 */
export async function getComplianceChecklists(
  agencyId: string,
  status?: ComplianceChecklist['status']
): Promise<ComplianceChecklist[]> {
  const checklistsRef = collection(db, 'agencies', agencyId, 'compliance_checklists');
  
  let q = query(checklistsRef, orderBy('dueDate', 'asc'));
  if (status) {
    q = query(q, where('status', '==', status));
  }
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    dueDate: doc.data().dueDate?.toDate?.() || new Date(doc.data().dueDate),
  })) as ComplianceChecklist[];
}

/**
 * Update checklist item
 */
export async function updateChecklistItem(
  agencyId: string,
  checklistId: string,
  itemId: string,
  updates: {
    completed: boolean;
    completedBy?: string;
    notes?: string;
  }
): Promise<void> {
  const checklistRef = doc(db, 'agencies', agencyId, 'compliance_checklists', checklistId);
  const checklistSnap = await getDoc(checklistRef);
  
  if (!checklistSnap.exists()) {
    throw new Error('Checklist not found');
  }
  
  const checklist = checklistSnap.data() as ComplianceChecklist;
  const items = checklist.items.map(item => {
    if (item.id === itemId) {
      return {
        ...item,
        ...updates,
        completedAt: updates.completed ? new Date() : undefined,
      };
    }
    return item;
  });
  
  // Update checklist status
  const allCompleted = items.every(item => !item.required || item.completed);
  const status = allCompleted ? 'completed' : checklist.status === 'pending' ? 'in_progress' : checklist.status;
  
  await updateDoc(checklistRef, {
    items,
    status,
    updatedAt: new Date(),
  });
}

/**
 * Get default compliance tasks for agency
 */
export function getDefaultComplianceTasks(): Omit<ComplianceTask, 'id'>[] {
  const now = new Date();
  
  return [
    {
      type: 'regulatory',
      name: 'Monthly Regulatory Report',
      description: 'Generate monthly regulatory report for Bank of Zambia',
      schedule: 'monthly',
      nextRun: new Date(now.getFullYear(), now.getMonth() + 1, 1),
      status: 'active',
      autoSubmit: false,
      recipients: [],
    },
    {
      type: 'tax',
      name: 'Quarterly Tax Report',
      description: 'Generate quarterly tax report for ZRA',
      schedule: 'quarterly',
      nextRun: new Date(now.getFullYear(), now.getMonth() + 3, 1),
      status: 'active',
      autoSubmit: false,
      recipients: [],
    },
    {
      type: 'kpi',
      name: 'Weekly KPI Report',
      description: 'Generate weekly KPI dashboard',
      schedule: 'weekly',
      nextRun: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
      status: 'active',
      autoSubmit: false,
      recipients: [],
    },
  ];
}

