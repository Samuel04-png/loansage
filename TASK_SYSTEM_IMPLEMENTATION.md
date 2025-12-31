# Task Assignment System & Role-Specific Enhancements

## Overview
This document outlines the comprehensive task assignment system and role-specific dashboard enhancements implemented for TengaLoans.

## ✅ Completed Features

### 1. Firestore-Based Task System
- **Location**: `src/features/tasks/pages/TasksPage.tsx`
- **Features**:
  - View assigned tasks (for all employees)
  - View all tasks (for Admins and Managers)
  - Filter by status (pending, in_progress, completed, cancelled)
  - Filter by priority (urgent, high, medium, low)
  - Search tasks by title, description, or type
  - Update task status (Start, Complete)
  - Link tasks to loans
  - Task type categorization (follow_up, field_visit, collection, call, documentation, review, other)

### 2. Task Assignment Dialog
- **Location**: `src/features/tasks/components/AssignTaskDialog.tsx`
- **Features**:
  - Assign tasks to employees
  - Set task priority (low, medium, high, urgent)
  - Set due dates
  - Link tasks to specific loans
  - Automatic notification creation for assigned employees
  - Available to Admins and Managers only

### 3. Firestore Security Rules
- **Location**: `firestore.rules`
- **Rules Added**:
  - Tasks subcollection under agencies
  - Read: Employees can read tasks assigned to them or tasks they assigned
  - Read: Admins and Managers can read all tasks
  - Create: Only Admins and Managers can create tasks
  - Update: Assigned employees can update their task status
  - Update: Admins and Managers can update any task
  - Delete: Only Admins and Managers can delete tasks

### 4. Role-Specific Dashboard Enhancements

#### Accountant Dashboard
- **Metrics**:
  - Pending Disbursements (approved loans awaiting disbursement)
  - Portfolio Value
  - Active Loans
  - Approved Loans
- **Visibility**: Accountants see all loans in the agency

#### Collections Officer Dashboard
- **Metrics**:
  - Overdue Repayments (count of overdue repayment records)
  - Active Loans
  - Portfolio Value
  - Overdue Loans
- **Focus**: Payment collection and overdue management

#### Underwriter Dashboard
- **Metrics**:
  - Pending Reviews (loans pending or under review)
  - My Loans
  - Portfolio Value
  - Approved Loans
- **Focus**: Loan approval and risk assessment

#### Manager Dashboard
- **Metrics**:
  - Team Loans (all loans in the agency)
  - Portfolio Value
  - Pending Approvals
  - Overdue Count
- **Visibility**: Managers see all loans and can assign tasks

#### Loan Officer Dashboard (Enhanced)
- **Metrics**:
  - My Loans
  - Portfolio Value
  - Pending Approvals
  - Overdue Loans
- **Features**:
  - Priority Queue showing pending approvals
  - View All Loans toggle (read-only for non-owned loans)

## 🔐 Security & Permissions

### Task Permissions
- **Admins**: Full access (create, read, update, delete all tasks)
- **Managers**: Full access (create, read, update, delete all tasks)
- **Employees**: Can only read and update tasks assigned to them

### Loan Visibility
- **Loan Officers**: Default to own loans, can toggle to view all (read-only for non-owned)
- **Accountants**: See all loans
- **Managers**: See all loans
- **Collections Officers**: See all loans (for collection purposes)
- **Underwriters**: See all loans (for review purposes)

## 📁 File Structure

```
src/
├── features/
│   ├── tasks/
│   │   ├── pages/
│   │   │   └── TasksPage.tsx (Main tasks page)
│   │   └── components/
│   │       └── AssignTaskDialog.tsx (Task assignment UI)
│   └── employee/
│       └── pages/
│           └── DashboardPage.tsx (Role-specific dashboards)
firestore.rules (Updated with tasks subcollection rules)
```

## 🚀 Usage

### Assigning a Task (Admin/Manager)
1. Navigate to `/employee/tasks`
2. Click "Assign Task" button
3. Fill in task details:
   - Title (required)
   - Description (optional)
   - Assign To (required - select employee)
   - Task Type
   - Priority
   - Due Date (optional)
   - Related Loan (optional)
4. Click "Assign Task"
5. Assigned employee receives a notification

### Viewing Tasks (All Employees)
1. Navigate to `/employee/tasks`
2. View tasks assigned to you
3. Filter by status or priority
4. Search for specific tasks
5. Update task status (Start, Complete)

### Role-Specific Dashboards
- Each role sees metrics relevant to their responsibilities
- Dashboards automatically adapt based on `employee_category`
- Quick actions are role-appropriate

## 🔄 Data Flow

1. **Task Creation**:
   - Admin/Manager creates task → Firestore `agencies/{agencyId}/tasks`
   - Notification created → Firestore `agencies/{agencyId}/notifications`
   - Assigned employee receives notification

2. **Task Updates**:
   - Employee updates status → Firestore rules validate permission
   - Status change triggers query invalidation
   - UI updates automatically

3. **Dashboard Metrics**:
   - Role-specific queries fetch relevant data
   - Metrics calculated based on loan statuses
   - Real-time updates via React Query

## 🛡️ Backend Validation

### Firestore Rules
- Tasks can only be created by Admins/Managers
- Employees can only update tasks assigned to them
- All operations require agency membership verification
- Task data includes assigned user IDs for permission checks

### Frontend Validation
- Form validation in AssignTaskDialog
- Role checks before showing assignment UI
- Permission checks before allowing status updates

## 📊 Task Data Model

```typescript
interface Task {
  id: string;
  title: string;
  description?: string;
  assignedTo: string; // Employee ID
  assignedToUserId: string; // User ID for notifications
  assignedToName: string;
  assignedBy: string; // Employee ID
  assignedByUserId: string;
  assignedByName: string;
  type: 'follow_up' | 'field_visit' | 'collection' | 'call' | 'documentation' | 'review' | 'other';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  dueDate?: Date;
  relatedLoanId?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

## 🎯 Next Steps (Optional Enhancements)

1. **Task Comments**: Add ability to comment on tasks
2. **Task Attachments**: Allow file uploads to tasks
3. **Task Templates**: Pre-defined task templates for common workflows
4. **Task Recurrence**: Schedule recurring tasks
5. **Task Analytics**: Dashboard showing task completion rates
6. **Task Reminders**: Email/push notifications for upcoming due dates
7. **Bulk Task Assignment**: Assign multiple tasks at once
8. **Task Dependencies**: Link tasks that depend on each other

## ✅ Testing Checklist

- [ ] Admin can assign tasks to employees
- [ ] Manager can assign tasks to employees
- [ ] Employee can view assigned tasks
- [ ] Employee can update task status
- [ ] Employee cannot assign tasks
- [ ] Employee cannot update tasks not assigned to them
- [ ] Notifications are created when tasks are assigned
- [ ] Role-specific dashboards show correct metrics
- [ ] Firestore rules prevent unauthorized access
- [ ] Task filters work correctly
- [ ] Task search works correctly
- [ ] Tasks can be linked to loans
- [ ] Due dates are displayed correctly

## 📝 Notes

- Tasks are stored in Firestore under `agencies/{agencyId}/tasks`
- Notifications are created automatically when tasks are assigned
- Task assignment requires employee records to exist
- All task operations respect agency boundaries
- Role-based access is enforced at both frontend and backend levels
