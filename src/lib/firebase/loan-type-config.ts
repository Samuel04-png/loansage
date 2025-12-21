/**
 * Firebase helpers for managing loan type configurations
 */

import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  collection, 
  query, 
  where, 
  getDocs,
  serverTimestamp,
  Timestamp 
} from 'firebase/firestore';
import { db } from './config';
import type { 
  AgencyLoanConfig, 
  LoanTypeConfig, 
  LoanTypeId,
  LoanTypeTemplate 
} from '../../types/loan-config';

/**
 * Default loan type templates
 * These are used to initialize loan types for new agencies
 */
export const DEFAULT_LOAN_TYPE_TEMPLATES: Record<LoanTypeId, LoanTypeTemplate> = {
  collateral_based: {
    id: 'collateral_based',
    name: 'Collateral-Based Loan',
    description: 'Loans secured by collateral assets',
    category: 'secured',
    defaultConfig: {
      name: 'Collateral-Based Loan',
      description: 'Loans secured by collateral assets',
      category: 'secured',
      icon: 'ShieldAlert',
      interestRate: {
        default: 12,
        min: 8,
        max: 24,
      },
      loanAmount: {
        min: 10000,
        max: 5000000,
        default: 100000,
      },
      duration: {
        minMonths: 6,
        maxMonths: 120,
        defaultMonths: 24,
        allowedFrequencies: ['monthly', 'biweekly', 'weekly'],
      },
      repaymentFrequency: ['monthly', 'biweekly'],
      collateralRequirement: 'required',
      requiredDocuments: [
        { type: 'nrc', label: 'National ID', required: true },
        { type: 'collateral_deed', label: 'Collateral Documentation', required: true },
        { type: 'valuation_report', label: 'Asset Valuation Report', required: true },
      ],
      customFields: [],
      riskRules: {
        minCollateralCoverage: 120,
        maxLoanToValue: 80,
      },
      eligibilityCriteria: {},
      interestCalculationMethod: 'reducing_balance',
      gracePeriodDays: 7,
      lateFeeRate: 2,
      maxLateFeeRate: 10,
      displayOrder: 1,
      color: '#3B82F6',
    },
  },
  salary_based: {
    id: 'salary_based',
    name: 'Salary-Based Loan',
    description: 'Loans based on borrower salary/income',
    category: 'unsecured',
    defaultConfig: {
      name: 'Salary-Based Loan',
      description: 'Loans based on borrower salary/income',
      category: 'unsecured',
      icon: 'Wallet',
      interestRate: {
        default: 15,
        min: 10,
        max: 30,
      },
      loanAmount: {
        min: 1000,
        max: 500000,
        default: 50000,
      },
      duration: {
        minMonths: 1,
        maxMonths: 36,
        defaultMonths: 12,
        allowedFrequencies: ['monthly', 'biweekly'],
      },
      repaymentFrequency: ['monthly'],
      collateralRequirement: 'not_required',
      requiredDocuments: [
        { type: 'nrc', label: 'National ID', required: true },
        { type: 'payslip', label: 'Salary Slip (3 months)', required: true },
        { type: 'bank_statement', label: 'Bank Statement (3 months)', required: true },
        { type: 'employment_letter', label: 'Employment Letter', required: true },
      ],
      customFields: [
        {
          name: 'employerName',
          label: 'Employer Name',
          type: 'text',
          required: true,
        },
        {
          name: 'employmentDuration',
          label: 'Employment Duration (months)',
          type: 'number',
          required: true,
          validation: { min: 6 },
        },
      ],
      riskRules: {
        minCreditScore: 600,
        maxDebtToIncome: 40,
        minMonthlyIncome: 3000,
      },
      eligibilityCriteria: {
        minAge: 21,
        maxAge: 65,
        employmentTypes: ['permanent', 'contract'],
      },
      interestCalculationMethod: 'reducing_balance',
      gracePeriodDays: 5,
      lateFeeRate: 2.5,
      maxLateFeeRate: 15,
      displayOrder: 2,
      color: '#10B981',
    },
  },
  sme_business: {
    id: 'sme_business',
    name: 'SME / Business Loan',
    description: 'Loans for small and medium enterprises',
    category: 'conditional',
    defaultConfig: {
      name: 'SME / Business Loan',
      description: 'Loans for small and medium enterprises',
      category: 'conditional',
      icon: 'Briefcase',
      interestRate: {
        default: 14,
        min: 10,
        max: 25,
      },
      loanAmount: {
        min: 50000,
        max: 10000000,
        default: 500000,
      },
      duration: {
        minMonths: 6,
        maxMonths: 120,
        defaultMonths: 36,
        allowedFrequencies: ['monthly', 'quarterly'],
      },
      repaymentFrequency: ['monthly', 'quarterly'],
      collateralRequirement: 'conditional',
      requiredDocuments: [
        { type: 'nrc', label: 'National ID', required: true },
        { type: 'business_license', label: 'Business License', required: true },
        { type: 'financial_statements', label: 'Financial Statements (2 years)', required: true },
        { type: 'bank_statement', label: 'Business Bank Statements (6 months)', required: true },
        { type: 'tax_returns', label: 'Tax Returns', required: false },
      ],
      customFields: [
        {
          name: 'businessType',
          label: 'Business Type',
          type: 'select',
          required: true,
          options: [
            { value: 'retail', label: 'Retail' },
            { value: 'wholesale', label: 'Wholesale' },
            { value: 'manufacturing', label: 'Manufacturing' },
            { value: 'services', label: 'Services' },
            { value: 'other', label: 'Other' },
          ],
        },
        {
          name: 'businessAge',
          label: 'Business Age (months)',
          type: 'number',
          required: true,
          validation: { min: 12 },
        },
      ],
      riskRules: {
        minCreditScore: 650,
        maxDebtToIncome: 50,
        minBusinessAge: 12,
        requiredGuarantors: 1,
      },
      eligibilityCriteria: {
        businessTypes: ['retail', 'wholesale', 'manufacturing', 'services'],
      },
      interestCalculationMethod: 'reducing_balance',
      gracePeriodDays: 10,
      lateFeeRate: 3,
      maxLateFeeRate: 20,
      displayOrder: 3,
      color: '#8B5CF6',
    },
  },
  personal_unsecured: {
    id: 'personal_unsecured',
    name: 'Personal Loan (Unsecured)',
    description: 'Unsecured personal loans for individual needs',
    category: 'unsecured',
    defaultConfig: {
      name: 'Personal Loan (Unsecured)',
      description: 'Unsecured personal loans for individual needs',
      category: 'unsecured',
      icon: 'User',
      interestRate: {
        default: 18,
        min: 12,
        max: 35,
      },
      loanAmount: {
        min: 1000,
        max: 200000,
        default: 25000,
      },
      duration: {
        minMonths: 3,
        maxMonths: 60,
        defaultMonths: 24,
        allowedFrequencies: ['monthly', 'biweekly', 'weekly'],
      },
      repaymentFrequency: ['monthly', 'biweekly'],
      collateralRequirement: 'not_required',
      requiredDocuments: [
        { type: 'nrc', label: 'National ID', required: true },
        { type: 'proof_of_income', label: 'Proof of Income', required: true },
        { type: 'bank_statement', label: 'Bank Statement (3 months)', required: false },
      ],
      customFields: [],
      riskRules: {
        minCreditScore: 550,
        maxDebtToIncome: 45,
      },
      eligibilityCriteria: {
        minAge: 18,
        maxAge: 70,
      },
      interestCalculationMethod: 'reducing_balance',
      gracePeriodDays: 5,
      lateFeeRate: 3,
      maxLateFeeRate: 15,
      displayOrder: 4,
      color: '#F59E0B',
    },
  },
  asset_financing: {
    id: 'asset_financing',
    name: 'Asset Financing',
    description: 'Financing for business assets and equipment',
    category: 'secured',
    defaultConfig: {
      name: 'Asset Financing',
      description: 'Financing for business assets and equipment',
      category: 'secured',
      icon: 'Wrench',
      interestRate: {
        default: 11,
        min: 8,
        max: 20,
      },
      loanAmount: {
        min: 20000,
        max: 5000000,
        default: 200000,
      },
      duration: {
        minMonths: 12,
        maxMonths: 84,
        defaultMonths: 48,
        allowedFrequencies: ['monthly', 'quarterly'],
      },
      repaymentFrequency: ['monthly'],
      collateralRequirement: 'required',
      requiredDocuments: [
        { type: 'nrc', label: 'National ID', required: true },
        { type: 'asset_invoice', label: 'Asset Invoice/Quote', required: true },
        { type: 'asset_registration', label: 'Asset Registration Documents', required: true },
      ],
      customFields: [
        {
          name: 'assetType',
          label: 'Asset Type',
          type: 'select',
          required: true,
          options: [
            { value: 'vehicle', label: 'Vehicle' },
            { value: 'equipment', label: 'Equipment' },
            { value: 'machinery', label: 'Machinery' },
            { value: 'other', label: 'Other' },
          ],
        },
      ],
      riskRules: {
        minCollateralCoverage: 110,
        maxLoanToValue: 85,
      },
      eligibilityCriteria: {},
      interestCalculationMethod: 'reducing_balance',
      gracePeriodDays: 7,
      lateFeeRate: 2,
      maxLateFeeRate: 12,
      displayOrder: 5,
      color: '#06B6D4',
    },
  },
  custom_mixed: {
    id: 'custom_mixed',
    name: 'Custom / Mixed Loan',
    description: 'Customizable loan products with flexible terms',
    category: 'hybrid',
    defaultConfig: {
      name: 'Custom / Mixed Loan',
      description: 'Customizable loan products with flexible terms',
      category: 'hybrid',
      icon: 'FileText',
      interestRate: {
        default: 15,
        min: 8,
        max: 30,
      },
      loanAmount: {
        min: 5000,
        max: 2000000,
        default: 100000,
      },
      duration: {
        minMonths: 3,
        maxMonths: 96,
        defaultMonths: 24,
        allowedFrequencies: ['monthly', 'biweekly', 'weekly', 'quarterly'],
      },
      repaymentFrequency: ['monthly', 'biweekly'],
      collateralRequirement: 'optional',
      requiredDocuments: [
        { type: 'nrc', label: 'National ID', required: true },
      ],
      customFields: [],
      riskRules: {},
      eligibilityCriteria: {},
      interestCalculationMethod: 'reducing_balance',
      gracePeriodDays: 7,
      lateFeeRate: 2.5,
      maxLateFeeRate: 15,
      displayOrder: 6,
      color: '#6366F1',
    },
  },
  // Additional loan types with minimal config (can be expanded)
  education: {
    id: 'education',
    name: 'Education Loan',
    description: 'For tuition fees and educational expenses',
    category: 'unsecured',
    defaultConfig: {
      name: 'Education Loan',
      description: 'For tuition fees and educational expenses',
      category: 'unsecured',
      icon: 'GraduationCap',
      interestRate: { default: 12, min: 8, max: 20 },
      loanAmount: { min: 2000, max: 500000, default: 50000 },
      duration: { minMonths: 6, maxMonths: 60, defaultMonths: 24, allowedFrequencies: ['monthly'] },
      repaymentFrequency: ['monthly'],
      collateralRequirement: 'not_required',
      requiredDocuments: [{ type: 'nrc', label: 'National ID', required: true }],
      customFields: [],
      riskRules: {},
      eligibilityCriteria: {},
      interestCalculationMethod: 'reducing_balance',
      gracePeriodDays: 30,
      lateFeeRate: 2,
      maxLateFeeRate: 10,
      displayOrder: 7,
      color: '#EC4899',
    },
  },
  medical: {
    id: 'medical',
    name: 'Medical Loan',
    description: 'For medical expenses and healthcare',
    category: 'unsecured',
    defaultConfig: {
      name: 'Medical Loan',
      description: 'For medical expenses and healthcare',
      category: 'unsecured',
      icon: 'Heart',
      interestRate: { default: 14, min: 10, max: 25 },
      loanAmount: { min: 1000, max: 300000, default: 30000 },
      duration: { minMonths: 3, maxMonths: 36, defaultMonths: 12, allowedFrequencies: ['monthly'] },
      repaymentFrequency: ['monthly'],
      collateralRequirement: 'not_required',
      requiredDocuments: [{ type: 'nrc', label: 'National ID', required: true }],
      customFields: [],
      riskRules: {},
      eligibilityCriteria: {},
      interestCalculationMethod: 'reducing_balance',
      gracePeriodDays: 7,
      lateFeeRate: 2.5,
      maxLateFeeRate: 15,
      displayOrder: 8,
      color: '#EF4444',
    },
  },
  emergency: {
    id: 'emergency',
    name: 'Emergency Loan',
    description: 'Quick access funds for urgent needs',
    category: 'unsecured',
    defaultConfig: {
      name: 'Emergency Loan',
      description: 'Quick access funds for urgent needs',
      category: 'unsecured',
      icon: 'AlertTriangle',
      interestRate: { default: 20, min: 15, max: 35 },
      loanAmount: { min: 500, max: 100000, default: 10000 },
      duration: { minMonths: 1, maxMonths: 12, defaultMonths: 6, allowedFrequencies: ['monthly', 'biweekly'] },
      repaymentFrequency: ['monthly'],
      collateralRequirement: 'not_required',
      requiredDocuments: [{ type: 'nrc', label: 'National ID', required: true }],
      customFields: [],
      riskRules: {},
      eligibilityCriteria: {},
      interestCalculationMethod: 'reducing_balance',
      gracePeriodDays: 3,
      lateFeeRate: 3,
      maxLateFeeRate: 20,
      displayOrder: 9,
      color: '#F97316',
    },
  },
  microfinance: {
    id: 'microfinance',
    name: 'Microfinance Loan',
    description: 'Small loans for micro-enterprises',
    category: 'unsecured',
    defaultConfig: {
      name: 'Microfinance Loan',
      description: 'Small loans for micro-enterprises',
      category: 'unsecured',
      icon: 'DollarSign',
      interestRate: { default: 16, min: 12, max: 30 },
      loanAmount: { min: 500, max: 100000, default: 20000 },
      duration: { minMonths: 1, maxMonths: 24, defaultMonths: 12, allowedFrequencies: ['monthly', 'biweekly'] },
      repaymentFrequency: ['monthly'],
      collateralRequirement: 'not_required',
      requiredDocuments: [{ type: 'nrc', label: 'National ID', required: true }],
      customFields: [],
      riskRules: {},
      eligibilityCriteria: {},
      interestCalculationMethod: 'reducing_balance',
      gracePeriodDays: 5,
      lateFeeRate: 2.5,
      maxLateFeeRate: 15,
      displayOrder: 10,
      color: '#14B8A6',
    },
  },
  group: {
    id: 'group',
    name: 'Group Loan',
    description: 'Loans for groups or associations',
    category: 'conditional',
    defaultConfig: {
      name: 'Group Loan',
      description: 'Loans for groups or associations',
      category: 'conditional',
      icon: 'Users',
      interestRate: { default: 13, min: 10, max: 25 },
      loanAmount: { min: 10000, max: 1000000, default: 100000 },
      duration: { minMonths: 6, maxMonths: 60, defaultMonths: 24, allowedFrequencies: ['monthly'] },
      repaymentFrequency: ['monthly'],
      collateralRequirement: 'conditional',
      requiredDocuments: [{ type: 'nrc', label: 'National ID', required: true }],
      customFields: [],
      riskRules: { requiredGuarantors: 2 },
      eligibilityCriteria: {},
      interestCalculationMethod: 'reducing_balance',
      gracePeriodDays: 7,
      lateFeeRate: 2.5,
      maxLateFeeRate: 15,
      displayOrder: 11,
      color: '#6366F1',
    },
  },
  equipment: {
    id: 'equipment',
    name: 'Equipment Finance',
    description: 'Financing for business equipment',
    category: 'secured',
    defaultConfig: {
      name: 'Equipment Finance',
      description: 'Financing for business equipment',
      category: 'secured',
      icon: 'Wrench',
      interestRate: { default: 11, min: 8, max: 20 },
      loanAmount: { min: 10000, max: 2000000, default: 150000 },
      duration: { minMonths: 12, maxMonths: 84, defaultMonths: 36, allowedFrequencies: ['monthly'] },
      repaymentFrequency: ['monthly'],
      collateralRequirement: 'required',
      requiredDocuments: [{ type: 'nrc', label: 'National ID', required: true }],
      customFields: [],
      riskRules: { minCollateralCoverage: 110 },
      eligibilityCriteria: {},
      interestCalculationMethod: 'reducing_balance',
      gracePeriodDays: 7,
      lateFeeRate: 2,
      maxLateFeeRate: 12,
      displayOrder: 12,
      color: '#06B6D4',
    },
  },
  working_capital: {
    id: 'working_capital',
    name: 'Working Capital',
    description: 'Short-term business operational funds',
    category: 'conditional',
    defaultConfig: {
      name: 'Working Capital',
      description: 'Short-term business operational funds',
      category: 'conditional',
      icon: 'TrendingUp',
      interestRate: { default: 15, min: 12, max: 28 },
      loanAmount: { min: 20000, max: 5000000, default: 200000 },
      duration: { minMonths: 3, maxMonths: 24, defaultMonths: 12, allowedFrequencies: ['monthly'] },
      repaymentFrequency: ['monthly'],
      collateralRequirement: 'conditional',
      requiredDocuments: [{ type: 'nrc', label: 'National ID', required: true }],
      customFields: [],
      riskRules: {},
      eligibilityCriteria: {},
      interestCalculationMethod: 'reducing_balance',
      gracePeriodDays: 7,
      lateFeeRate: 3,
      maxLateFeeRate: 18,
      displayOrder: 13,
      color: '#10B981',
    },
  },
  invoice_financing: {
    id: 'invoice_financing',
    name: 'Invoice Financing',
    description: 'Financing against outstanding invoices',
    category: 'conditional',
    defaultConfig: {
      name: 'Invoice Financing',
      description: 'Financing against outstanding invoices',
      category: 'conditional',
      icon: 'FileText',
      interestRate: { default: 12, min: 8, max: 22 },
      loanAmount: { min: 50000, max: 10000000, default: 500000 },
      duration: { minMonths: 1, maxMonths: 12, defaultMonths: 3, allowedFrequencies: ['monthly'] },
      repaymentFrequency: ['monthly'],
      collateralRequirement: 'not_required',
      requiredDocuments: [{ type: 'nrc', label: 'National ID', required: true }],
      customFields: [],
      riskRules: {},
      eligibilityCriteria: {},
      interestCalculationMethod: 'simple',
      gracePeriodDays: 5,
      lateFeeRate: 2,
      maxLateFeeRate: 10,
      displayOrder: 14,
      color: '#8B5CF6',
    },
  },
  trade_finance: {
    id: 'trade_finance',
    name: 'Trade Finance',
    description: 'Financing for import/export activities',
    category: 'secured',
    defaultConfig: {
      name: 'Trade Finance',
      description: 'Financing for import/export activities',
      category: 'secured',
      icon: 'ShoppingCart',
      interestRate: { default: 10, min: 7, max: 18 },
      loanAmount: { min: 100000, max: 20000000, default: 1000000 },
      duration: { minMonths: 1, maxMonths: 12, defaultMonths: 6, allowedFrequencies: ['monthly'] },
      repaymentFrequency: ['monthly'],
      collateralRequirement: 'required',
      requiredDocuments: [{ type: 'nrc', label: 'National ID', required: true }],
      customFields: [],
      riskRules: { minCollateralCoverage: 120 },
      eligibilityCriteria: {},
      interestCalculationMethod: 'simple',
      gracePeriodDays: 7,
      lateFeeRate: 2,
      maxLateFeeRate: 12,
      displayOrder: 15,
      color: '#3B82F6',
    },
  },
  refinancing: {
    id: 'refinancing',
    name: 'Refinancing',
    description: 'Refinance existing loans at better rates',
    category: 'conditional',
    defaultConfig: {
      name: 'Refinancing',
      description: 'Refinance existing loans at better rates',
      category: 'conditional',
      icon: 'ArrowRightLeft',
      interestRate: { default: 11, min: 8, max: 20 },
      loanAmount: { min: 10000, max: 10000000, default: 200000 },
      duration: { minMonths: 12, maxMonths: 240, defaultMonths: 60, allowedFrequencies: ['monthly'] },
      repaymentFrequency: ['monthly'],
      collateralRequirement: 'conditional',
      requiredDocuments: [{ type: 'nrc', label: 'National ID', required: true }],
      customFields: [],
      riskRules: {},
      eligibilityCriteria: {},
      interestCalculationMethod: 'reducing_balance',
      gracePeriodDays: 7,
      lateFeeRate: 2,
      maxLateFeeRate: 12,
      displayOrder: 16,
      color: '#6366F1',
    },
  },
  construction: {
    id: 'construction',
    name: 'Construction Loan',
    description: 'Financing for construction projects',
    category: 'secured',
    defaultConfig: {
      name: 'Construction Loan',
      description: 'Financing for construction projects',
      category: 'secured',
      icon: 'Building2',
      interestRate: { default: 12, min: 9, max: 22 },
      loanAmount: { min: 100000, max: 20000000, default: 1000000 },
      duration: { minMonths: 12, maxMonths: 120, defaultMonths: 60, allowedFrequencies: ['monthly', 'quarterly'] },
      repaymentFrequency: ['monthly'],
      collateralRequirement: 'required',
      requiredDocuments: [{ type: 'nrc', label: 'National ID', required: true }],
      customFields: [],
      riskRules: { minCollateralCoverage: 130 },
      eligibilityCriteria: {},
      interestCalculationMethod: 'reducing_balance',
      gracePeriodDays: 14,
      lateFeeRate: 2.5,
      maxLateFeeRate: 15,
      displayOrder: 17,
      color: '#F59E0B',
    },
  },
};

/**
 * Initialize loan configuration for a new agency
 */
export async function initializeAgencyLoanConfig(
  agencyId: string,
  selectedLoanTypes: LoanTypeId[] = []
): Promise<AgencyLoanConfig> {
  const loanTypes: Record<LoanTypeId, LoanTypeConfig> = {} as any;
  const now = new Date();

  // If no types selected, use common defaults
  const typesToInitialize = selectedLoanTypes.length > 0 
    ? selectedLoanTypes 
    : ['collateral_based', 'salary_based', 'personal_unsecured'];

  for (const typeId of typesToInitialize) {
    const template = DEFAULT_LOAN_TYPE_TEMPLATES[typeId];
    if (template) {
      loanTypes[typeId] = {
        ...template.defaultConfig,
        id: template.id,
        enabled: true,
        createdAt: now,
        updatedAt: now,
      };
    }
  }

  const config: AgencyLoanConfig = {
    agencyId,
    loanTypes,
    globalDefaults: {
      currency: 'ZMW',
      defaultInterestRate: 15,
      defaultGracePeriod: 7,
      defaultLateFeeRate: 2.5,
    },
    createdAt: now,
    updatedAt: now,
    version: 1,
  };

  const configRef = doc(db, 'agencies', agencyId, 'config', 'loanTypes');
  await setDoc(configRef, {
    ...config,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return config;
}

/**
 * Get loan configuration for an agency
 */
export async function getAgencyLoanConfig(agencyId: string): Promise<AgencyLoanConfig | null> {
  const configRef = doc(db, 'agencies', agencyId, 'config', 'loanTypes');
  const configSnap = await getDoc(configRef);

  if (!configSnap.exists()) {
    return null;
  }

  const data = configSnap.data();
  return {
    ...data,
    createdAt: data.createdAt?.toDate() || new Date(),
    updatedAt: data.updatedAt?.toDate() || new Date(),
  } as AgencyLoanConfig;
}

/**
 * Update loan configuration for an agency
 */
export async function updateAgencyLoanConfig(
  agencyId: string,
  updates: Partial<AgencyLoanConfig>
): Promise<void> {
  const configRef = doc(db, 'agencies', agencyId, 'config', 'loanTypes');
  
  await updateDoc(configRef, {
    ...updates,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Enable or disable a loan type for an agency
 */
export async function toggleLoanType(
  agencyId: string,
  loanTypeId: LoanTypeId,
  enabled: boolean
): Promise<void> {
  const config = await getAgencyLoanConfig(agencyId);
  if (!config) {
    throw new Error('Loan configuration not found. Please initialize first.');
  }

  if (config.loanTypes[loanTypeId]) {
    config.loanTypes[loanTypeId].enabled = enabled;
    config.loanTypes[loanTypeId].updatedAt = new Date();
  } else {
    // Add new loan type from template
    const template = DEFAULT_LOAN_TYPE_TEMPLATES[loanTypeId];
    if (template) {
      config.loanTypes[loanTypeId] = {
        ...template.defaultConfig,
        id: template.id,
        enabled,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    } else {
      throw new Error(`Loan type template not found: ${loanTypeId}`);
    }
  }

  await updateAgencyLoanConfig(agencyId, config);
}

/**
 * Update configuration for a specific loan type
 */
export async function updateLoanTypeConfig(
  agencyId: string,
  loanTypeId: LoanTypeId,
  updates: Partial<LoanTypeConfig>
): Promise<void> {
  const config = await getAgencyLoanConfig(agencyId);
  if (!config) {
    throw new Error('Loan configuration not found. Please initialize first.');
  }

  if (!config.loanTypes[loanTypeId]) {
    throw new Error(`Loan type ${loanTypeId} not found in agency configuration`);
  }

  config.loanTypes[loanTypeId] = {
    ...config.loanTypes[loanTypeId],
    ...updates,
    updatedAt: new Date(),
  };

  await updateAgencyLoanConfig(agencyId, config);
}

/**
 * Get enabled loan types for an agency
 */
export async function getEnabledLoanTypes(agencyId: string): Promise<LoanTypeConfig[]> {
  const config = await getAgencyLoanConfig(agencyId);
  if (!config) {
    return [];
  }

  return Object.values(config.loanTypes)
    .filter(lt => lt.enabled)
    .sort((a, b) => a.displayOrder - b.displayOrder);
}

/**
 * Get a specific loan type configuration
 */
export async function getLoanTypeConfig(
  agencyId: string,
  loanTypeId: LoanTypeId
): Promise<LoanTypeConfig | null> {
  const config = await getAgencyLoanConfig(agencyId);
  if (!config) {
    return null;
  }

  return config.loanTypes[loanTypeId] || null;
}

