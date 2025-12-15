# TengaLoans - Multi-Tenant Loan Management SaaS Platform

Enterprise-grade microfinance SaaS platform with AI-driven underwriting, multi-tenant architecture, and comprehensive role-based access control.

## Features

- **Multi-Tenant Architecture**: Complete data isolation with white-labeling support
- **Role-Based Access Control**: Admin, Employee (multiple categories), and Customer portals
- **AI-Powered Underwriting**: Google Gemini integration for risk assessment
- **Complete Authentication**: Firebase Auth with email verification, password reset
- **Loan Management**: Full loan lifecycle from origination to repayment
- **Real-Time Features**: Notifications, messaging, and live updates
- **Mobile Ready**: PWA support and React Native mobile app structure
- **World-Class UI/UX**: Modern design with animations, glassmorphism, and dark mode

## Tech Stack

- **Frontend**: React 19 + TypeScript + Vite
- **Backend**: Firebase (Auth, Firestore, Storage, Realtime)
- **State Management**: Zustand + React Query
- **Routing**: React Router v6
- **Forms**: React Hook Form + Zod
- **UI**: Tailwind CSS + shadcn/ui components
- **Charts**: Recharts
- **AI**: Google Gemini API
- **Animations**: Framer Motion

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Firebase account
- Google Gemini API key

### Installation

1. Clone the repository
```bash
git clone <repository-url>
cd tengaloans
```

2. Install dependencies
```bash
npm install --legacy-peer-deps
```

3. Set up environment variables
```bash
cp .env.example .env.local
```

Edit `.env.local` and add your Firebase configuration:
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `GEMINI_API_KEY` (optional)

4. Set up Firebase

Follow the complete setup guide in `FIREBASE_SETUP.md`:
- Create Firebase project
- Enable Authentication (Email/Password)
- Create Firestore database
- Set up Storage bucket
- Configure security rules

6. Start the development server
```bash
npm run dev
```

The app will be available at `http://localhost:3000`

## Project Structure

```
tengaloans/
├── src/
│   ├── app/                  # App entry and routing
│   ├── features/            # Feature modules
│   │   ├── auth/            # Authentication pages
│   │   ├── admin/           # Admin portal
│   │   ├── employee/        # Employee portal
│   │   ├── customer/        # Customer portal
│   │   └── public/          # Public pages
│   ├── components/          # Shared components
│   │   ├── ui/              # UI components
│   │   ├── guards/          # Route guards
│   │   └── providers/       # Context providers
│   ├── lib/                 # Utilities and configs
│   │   ├── supabase/        # Supabase client and helpers
│   │   └── utils.ts         # Utility functions
│   ├── stores/             # Zustand stores
│   ├── hooks/               # Custom React hooks
│   └── styles/             # Global styles
├── supabase/
│   ├── migrations/          # Database migrations
│   └── seed.sql            # Seed data
└── package.json
```

## Database Schema

The application uses Supabase PostgreSQL with Row Level Security (RLS) for multi-tenant data isolation.

### Key Tables

- `agencies` - Multi-tenant root table
- `users` - User accounts (extends Supabase auth.users)
- `employees` - Employee records
- `customers` - Customer/borrower records
- `loans` - Loan applications and active loans
- `loan_repayments` - Repayment schedule and history
- `collateral` - Collateral assets
- `documents` - Document storage
- `notifications` - User notifications
- `messages` - Internal messaging
- `tasks` - Task management
- `audit_logs` - Activity logs

## Authentication Flow

1. **Sign Up**: Users can sign up as Admin or Employee
2. **Organization Creation**: Admins create their agency during signup
3. **Email Verification**: Users verify their email
4. **Role-Based Access**: Users are redirected to their appropriate portal

## User Roles

### Admin
- Full access to all features
- Agency management
- Employee management
- Customer management
- Loan portfolio oversight
- Reports and analytics
- White-label settings

### Employee Categories
- **Loan Officer**: Originate and manage loans
- **Field Officer**: Field visits and customer verification
- **Collections Officer**: Payment collection and overdue management
- **Underwriter**: Loan approval and risk assessment
- **Accountant**: Financial management and reconciliation
- **Manager**: Team oversight and approvals

### Customer
- View own loans
- Check repayment schedule
- Upload documents
- View messages
- Make payments (UI)

## Development

### Running Tests
```bash
npm test
```

### Building for Production
```bash
npm run build
```

### Preview Production Build
```bash
npm run preview
```

## Environment Variables

See `.env.example` for required environment variables.

## License

Private - All rights reserved

## Support

For support, email support@tengaloans.com or visit our documentation.
