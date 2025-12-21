import {
  User,
  Briefcase,
  Sprout,
  Car,
  Home,
  GraduationCap,
  Heart,
  AlertTriangle,
  Wallet,
  Users,
  Wrench,
  TrendingUp,
  FileText,
  ShoppingCart,
  Building2,
  ArrowRightLeft,
  DollarSign,
} from 'lucide-react';
import { LucideIcon } from 'lucide-react';

export type LoanType =
  | 'personal'
  | 'business'
  | 'agriculture'
  | 'vehicle'
  | 'property'
  | 'education'
  | 'medical'
  | 'emergency'
  | 'salary_advance'
  | 'microfinance'
  | 'group'
  | 'equipment'
  | 'working_capital'
  | 'invoice_financing'
  | 'trade_finance'
  | 'refinancing'
  | 'asset_finance'
  | 'construction';

export interface LoanTypeConfig {
  type: LoanType;
  label: string;
  description: string;
  icon: LucideIcon;
  requiresCollateral: boolean;
  category: 'secured' | 'unsecured' | 'conditional';
  typicalAmountRange: { min: number; max: number };
  typicalDurationMonths: { min: number; max: number };
}

export const LOAN_TYPES: LoanTypeConfig[] = [
  // Existing types
  {
    type: 'personal',
    label: 'Personal Loan',
    description: 'For personal expenses and needs',
    icon: User,
    requiresCollateral: false,
    category: 'unsecured',
    typicalAmountRange: { min: 1000, max: 500000 },
    typicalDurationMonths: { min: 1, max: 60 },
  },
  {
    type: 'business',
    label: 'Business Loan',
    description: 'For business operations and expansion',
    icon: Briefcase,
    requiresCollateral: true,
    category: 'conditional',
    typicalAmountRange: { min: 10000, max: 5000000 },
    typicalDurationMonths: { min: 6, max: 120 },
  },
  {
    type: 'agriculture',
    label: 'Agriculture Loan',
    description: 'For farming and agricultural activities',
    icon: Sprout,
    requiresCollateral: true,
    category: 'secured',
    typicalAmountRange: { min: 5000, max: 2000000 },
    typicalDurationMonths: { min: 3, max: 36 },
  },
  {
    type: 'vehicle',
    label: 'Vehicle Loan',
    description: 'Vehicle purchase or repair financing',
    icon: Car,
    requiresCollateral: true,
    category: 'secured',
    typicalAmountRange: { min: 5000, max: 1000000 },
    typicalDurationMonths: { min: 12, max: 84 },
  },
  {
    type: 'property',
    label: 'Property Loan',
    description: 'Property investment and real estate',
    icon: Home,
    requiresCollateral: true,
    category: 'secured',
    typicalAmountRange: { min: 50000, max: 10000000 },
    typicalDurationMonths: { min: 60, max: 360 },
  },
  // New loan types
  {
    type: 'education',
    label: 'Education Loan',
    description: 'For tuition fees and educational expenses',
    icon: GraduationCap,
    requiresCollateral: false,
    category: 'unsecured',
    typicalAmountRange: { min: 2000, max: 500000 },
    typicalDurationMonths: { min: 6, max: 60 },
  },
  {
    type: 'medical',
    label: 'Medical Loan',
    description: 'For medical expenses and healthcare',
    icon: Heart,
    requiresCollateral: false,
    category: 'unsecured',
    typicalAmountRange: { min: 1000, max: 300000 },
    typicalDurationMonths: { min: 3, max: 36 },
  },
  {
    type: 'emergency',
    label: 'Emergency Loan',
    description: 'Quick access funds for urgent needs',
    icon: AlertTriangle,
    requiresCollateral: false,
    category: 'unsecured',
    typicalAmountRange: { min: 500, max: 100000 },
    typicalDurationMonths: { min: 1, max: 12 },
  },
  {
    type: 'salary_advance',
    label: 'Salary Advance',
    description: 'Advance against upcoming salary',
    icon: Wallet,
    requiresCollateral: false,
    category: 'unsecured',
    typicalAmountRange: { min: 500, max: 50000 },
    typicalDurationMonths: { min: 1, max: 3 },
  },
  {
    type: 'microfinance',
    label: 'Microfinance Loan',
    description: 'Small loans for micro-enterprises',
    icon: DollarSign,
    requiresCollateral: false,
    category: 'unsecured',
    typicalAmountRange: { min: 500, max: 100000 },
    typicalDurationMonths: { min: 1, max: 24 },
  },
  {
    type: 'group',
    label: 'Group Loan',
    description: 'Loans for groups or associations',
    icon: Users,
    requiresCollateral: false,
    category: 'conditional',
    typicalAmountRange: { min: 10000, max: 1000000 },
    typicalDurationMonths: { min: 6, max: 60 },
  },
  {
    type: 'equipment',
    label: 'Equipment Finance',
    description: 'Financing for business equipment',
    icon: Wrench,
    requiresCollateral: true,
    category: 'secured',
    typicalAmountRange: { min: 10000, max: 2000000 },
    typicalDurationMonths: { min: 12, max: 84 },
  },
  {
    type: 'working_capital',
    label: 'Working Capital',
    description: 'Short-term business operational funds',
    icon: TrendingUp,
    requiresCollateral: true,
    category: 'conditional',
    typicalAmountRange: { min: 20000, max: 5000000 },
    typicalDurationMonths: { min: 3, max: 24 },
  },
  {
    type: 'invoice_financing',
    label: 'Invoice Financing',
    description: 'Financing against outstanding invoices',
    icon: FileText,
    requiresCollateral: false,
    category: 'conditional',
    typicalAmountRange: { min: 50000, max: 10000000 },
    typicalDurationMonths: { min: 1, max: 12 },
  },
  {
    type: 'trade_finance',
    label: 'Trade Finance',
    description: 'Financing for import/export activities',
    icon: ShoppingCart,
    requiresCollateral: true,
    category: 'secured',
    typicalAmountRange: { min: 100000, max: 20000000 },
    typicalDurationMonths: { min: 1, max: 12 },
  },
  {
    type: 'refinancing',
    label: 'Refinancing',
    description: 'Refinance existing loans at better rates',
    icon: ArrowRightLeft,
    requiresCollateral: true,
    category: 'conditional',
    typicalAmountRange: { min: 10000, max: 10000000 },
    typicalDurationMonths: { min: 12, max: 240 },
  },
  {
    type: 'asset_finance',
    label: 'Asset Finance',
    description: 'Financing for business assets',
    icon: Building2,
    requiresCollateral: true,
    category: 'secured',
    typicalAmountRange: { min: 50000, max: 5000000 },
    typicalDurationMonths: { min: 24, max: 120 },
  },
  {
    type: 'construction',
    label: 'Construction Loan',
    description: 'Financing for construction projects',
    icon: Building2,
    requiresCollateral: true,
    category: 'secured',
    typicalAmountRange: { min: 100000, max: 20000000 },
    typicalDurationMonths: { min: 12, max: 120 },
  },
];

export function getLoanTypeConfig(type: LoanType): LoanTypeConfig | undefined {
  return LOAN_TYPES.find((lt) => lt.type === type);
}

export function getLoanTypesByCategory(category: 'secured' | 'unsecured' | 'conditional'): LoanTypeConfig[] {
  return LOAN_TYPES.filter((lt) => lt.category === category);
}

export function requiresCollateral(loanType: LoanType): boolean {
  const config = getLoanTypeConfig(loanType);
  return config?.requiresCollateral ?? false;
}

