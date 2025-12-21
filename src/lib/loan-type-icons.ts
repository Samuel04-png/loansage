/**
 * Icon mapping for loan types
 * Maps loan type IDs to Lucide React icon components
 */

import {
  ShieldAlert,
  Wallet,
  Briefcase,
  User,
  Wrench,
  FileText,
  GraduationCap,
  Heart,
  AlertTriangle,
  DollarSign,
  Users,
  TrendingUp,
  ShoppingCart,
  Building2,
  ArrowRightLeft,
  Car,
  Home,
  Sprout,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { LoanTypeId } from '../types/loan-config';

export const LOAN_TYPE_ICONS: Record<LoanTypeId, LucideIcon> = {
  collateral_based: ShieldAlert,
  salary_based: Wallet,
  sme_business: Briefcase,
  personal_unsecured: User,
  asset_financing: Wrench,
  custom_mixed: FileText,
  education: GraduationCap,
  medical: Heart,
  emergency: AlertTriangle,
  microfinance: DollarSign,
  group: Users,
  equipment: Wrench,
  working_capital: TrendingUp,
  invoice_financing: FileText,
  trade_finance: ShoppingCart,
  refinancing: ArrowRightLeft,
  construction: Building2,
};

/**
 * Get icon component for a loan type
 */
export function getLoanTypeIcon(loanTypeId: LoanTypeId): LucideIcon {
  return LOAN_TYPE_ICONS[loanTypeId] || FileText;
}

