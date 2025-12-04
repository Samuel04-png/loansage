export enum UserRole {
  ADMIN = 'ADMIN',
  OFFICER = 'OFFICER',
  CUSTOMER = 'CUSTOMER'
}

export enum LoanStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  ACTIVE = 'ACTIVE',
  REJECTED = 'REJECTED',
  PAID = 'PAID',
  DEFAULTED = 'DEFAULTED'
}

export enum CollateralType {
  VEHICLE = 'VEHICLE',
  PROPERTY = 'PROPERTY',
  ELECTRONICS = 'ELECTRONICS',
  JEWELRY = 'JEWELRY',
  OTHER = 'OTHER'
}

export interface Borrower {
  id: string;
  name: string;
  email: string;
  phone: string;
  riskScore: number;
  nrcNumber: string;
  photoUrl?: string;
  tenantId: string;
  kycStatus: 'VERIFIED' | 'PENDING' | 'REJECTED';
  documents: BorrowerDocument[];
  notes?: string;
}

export interface BorrowerDocument {
  id: string;
  type: 'NRC' | 'UTILITY' | 'PAYSLIP' | 'OTHER';
  name: string;
  url: string;
  dateAdded: Date;
}

export interface Collateral {
  id: string;
  type: CollateralType;
  description: string;
  value: number;
  currency: string;
  imageUrl?: string;
  status: 'VERIFIED' | 'PENDING' | 'RELEASED';
}

export interface Loan {
  id: string;
  borrowerId: string;
  borrowerName: string;
  amount: number;
  currency: string;
  interestRate: number;
  durationMonths: number;
  startDate: string;
  status: LoanStatus;
  collateral: Collateral[];
  repaymentProgress: number; // 0-100
  tenantId: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  isThinking?: boolean;
}

export interface AIAnalysisResult {
  riskAssessment: string;
  recommendedAction: string;
  confidence: number;
  flaggedIssues: string[];
}