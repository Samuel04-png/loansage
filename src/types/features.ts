// Feature Types for All Premium Features

// 1. Security Features
export interface TwoFactorAuth {
  enabled: boolean;
  method: 'sms' | 'email' | 'app';
  secret?: string;
  backupCodes?: string[];
}

export interface IPWhitelist {
  enabled: boolean;
  ips: string[];
}

export interface SecuritySettings {
  twoFactorAuth: TwoFactorAuth;
  ipWhitelist: IPWhitelist;
  sessionTimeout: number; // minutes
  passwordPolicy: {
    minLength: number;
    requireUppercase: boolean;
    requireLowercase: boolean;
    requireNumbers: boolean;
    requireSpecialChars: boolean;
  };
}

// 2. Loan Product Builder
export interface LoanProduct {
  id: string;
  name: string;
  description: string;
  interestRate: number;
  minAmount: number;
  maxAmount: number;
  minDuration: number;
  maxDuration: number;
  gracePeriodDays: number;
  lateFeeRate: number;
  maxLateFeeRate: number;
  interestCalculationMethod: 'simple' | 'compound';
  requiresCollateral: boolean;
  collateralTypes: string[];
  eligibilityCriteria: {
    minCreditScore?: number;
    minIncome?: number;
    maxDebtToIncome?: number;
  };
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// 3. SMS/WhatsApp Notifications
export interface NotificationTemplate {
  id: string;
  name: string;
  type: 'sms' | 'whatsapp' | 'email';
  trigger: 'payment_due' | 'payment_overdue' | 'loan_approved' | 'loan_rejected' | 'payment_received' | 'custom';
  message: string;
  variables: string[]; // e.g., ['{customerName}', '{amount}', '{dueDate}']
  isActive: boolean;
}

export interface NotificationLog {
  id: string;
  templateId: string;
  recipient: string;
  type: 'sms' | 'whatsapp' | 'email';
  status: 'pending' | 'sent' | 'failed' | 'delivered';
  message: string;
  sentAt?: Date;
  deliveredAt?: Date;
  error?: string;
}

// 4. Mobile Money Integration
export interface MobileMoneyProvider {
  id: string;
  name: 'mtn' | 'airtel' | 'zamtel' | 'other';
  apiKey: string;
  apiSecret: string;
  merchantId: string;
  isActive: boolean;
}

export interface PaymentLink {
  id: string;
  loanId: string;
  customerId: string;
  amount: number;
  provider: 'mtn' | 'airtel' | 'zamtel';
  link: string;
  qrCode?: string;
  expiresAt: Date;
  status: 'pending' | 'paid' | 'expired' | 'cancelled';
  paidAt?: Date;
  transactionId?: string;
}

// 5. Credit Scoring
export interface CreditScore {
  score: number; // 0-1000
  tier: 'A' | 'B' | 'C' | 'D';
  factors: {
    paymentHistory: number;
    debtToIncome: number;
    creditHistory: number;
    collateralValue: number;
    employmentStability: number;
  };
  recommendations: {
    maxLoanAmount: number;
    recommendedInterestRate: number;
    riskLevel: 'low' | 'medium' | 'high' | 'very_high';
  };
  calculatedAt: Date;
}

export interface RiskAssessment {
  customerId: string;
  loanId?: string;
  creditScore: CreditScore;
  defaultProbability: number; // 0-1
  riskFactors: string[];
  positiveFactors: string[];
  recommendation: 'approve' | 'approve_with_conditions' | 'reject';
  conditions?: string[];
}

// 6. Advanced Analytics
export interface ForecastData {
  period: string;
  predictedRevenue: number;
  predictedLoans: number;
  predictedDefaults: number;
  confidence: number;
}

export interface PortfolioHealth {
  overallScore: number; // 0-100
  metrics: {
    defaultRate: number;
    collectionRate: number;
    averageDaysToRepay: number;
    portfolioAtRisk: number;
    profitability: number;
  };
  trends: {
    defaultRate: 'improving' | 'stable' | 'declining';
    collectionRate: 'improving' | 'stable' | 'declining';
    profitability: 'improving' | 'stable' | 'declining';
  };
  alerts: string[];
}

// 7. Customer Self-Service Portal
export interface CustomerPortalSettings {
  enabled: boolean;
  allowPayments: boolean;
  allowDocumentUpload: boolean;
  allowLoanRequests: boolean;
  allowStatementDownload: boolean;
  customBranding?: {
    logo?: string;
    primaryColor?: string;
    secondaryColor?: string;
  };
}

// 8. Document Management
export interface DocumentTemplate {
  id: string;
  name: string;
  type: 'loan_agreement' | 'contract' | 'invoice' | 'statement' | 'other';
  content: string; // HTML or template
  variables: string[];
  isActive: boolean;
}

export interface ESignature {
  id: string;
  documentId: string;
  signerId: string;
  signerName: string;
  signerEmail: string;
  status: 'pending' | 'signed' | 'declined' | 'expired';
  signedAt?: Date;
  ipAddress?: string;
  signatureData?: string; // Base64 image
}

// 9. Multi-Branch Management
export interface Branch {
  id: string;
  name: string;
  code: string;
  address: string;
  phone: string;
  email: string;
  managerId?: string;
  isActive: boolean;
  settings: {
    timezone: string;
    currency: string;
    operatingHours: {
      [key: string]: { open: string; close: string; closed: boolean };
    };
  };
  createdAt: Date;
}

// 10. Collections Workflow
export interface CollectionCase {
  id: string;
  loanId: string;
  customerId: string;
  amount: number;
  daysOverdue: number;
  assignedTo?: string;
  status: 'new' | 'contacted' | 'negotiating' | 'resolved' | 'escalated' | 'written_off';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  notes: CollectionNote[];
  nextAction?: {
    type: 'call' | 'visit' | 'legal' | 'other';
    scheduledAt: Date;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface CollectionNote {
  id: string;
  caseId: string;
  authorId: string;
  type: 'call' | 'visit' | 'email' | 'sms' | 'other';
  content: string;
  outcome: 'no_answer' | 'promised_payment' | 'refused' | 'other';
  nextFollowUp?: Date;
  createdAt: Date;
}

// 11. Compliance Reporting
export interface ComplianceReport {
  id: string;
  type: 'regulatory' | 'tax' | 'audit' | 'custom';
  name: string;
  period: {
    start: Date;
    end: Date;
  };
  status: 'draft' | 'generated' | 'submitted' | 'approved';
  data: Record<string, any>;
  generatedAt?: Date;
  generatedBy?: string;
  submittedAt?: Date;
}

export interface ComplianceChecklist {
  id: string;
  name: string;
  category: string;
  items: ComplianceItem[];
  isCompleted: boolean;
  completedAt?: Date;
  completedBy?: string;
}

export interface ComplianceItem {
  id: string;
  description: string;
  isRequired: boolean;
  isCompleted: boolean;
  completedAt?: Date;
  notes?: string;
  attachments?: string[];
}

// 12. Referral & Loyalty Program
export interface ReferralProgram {
  enabled: boolean;
  rewardType: 'points' | 'cash' | 'discount';
  referralReward: number;
  refereeReward: number;
  minimumLoanAmount?: number;
  maxReferralsPerUser?: number;
}

export interface LoyaltyPoints {
  customerId: string;
  totalPoints: number;
  availablePoints: number;
  usedPoints: number;
  transactions: LoyaltyTransaction[];
}

export interface LoyaltyTransaction {
  id: string;
  type: 'earned' | 'redeemed' | 'expired';
  points: number;
  reason: string;
  loanId?: string;
  createdAt: Date;
}

// 13. Integrations
export interface Integration {
  id: string;
  name: string;
  type: 'bank_statement' | 'accounting' | 'payment_gateway' | 'credit_bureau' | 'other';
  provider: string;
  isActive: boolean;
  config: Record<string, any>;
  lastSync?: Date;
  syncStatus: 'success' | 'error' | 'pending';
  error?: string;
}

// 14. White-Label Mobile App
export interface MobileAppConfig {
  enabled: boolean;
  appName: string;
  packageName: string;
  icon?: string;
  splashScreen?: string;
  primaryColor: string;
  features: {
    payments: boolean;
    statements: boolean;
    notifications: boolean;
    documents: boolean;
    loanRequests: boolean;
  };
}

// 15. Enhanced Audit Logs
export interface EnhancedAuditLog {
  id: string;
  actorId: string;
  actorName: string;
  action: string;
  targetType: string;
  targetId: string;
  changes?: Record<string, { old: any; new: any }>;
  ipAddress: string;
  userAgent: string;
  location?: {
    country?: string;
    city?: string;
  };
  timestamp: Date;
}

