/**
 * AI Bulk Import Assistant
 * Analyzes uploaded spreadsheets, suggests column mappings, cleans data, and suggests matches
 * AI is an intelligence layer - it never generates IDs or writes to Firestore
 */

import { callDeepSeekAPI } from './deepseek-client';

export interface ColumnMapping {
  fileColumn: string;
  systemField: string;
  confidence: number;
  explanation: string;
}

export interface DataCleaningSuggestion {
  rowIndex: number;
  field: string;
  originalValue: string;
  suggestedValue: string;
  reason: string;
  confidence: number;
}

export interface MatchSuggestion {
  rowIndex: number;
  type: 'customer' | 'loan';
  suggestedMatch?: {
    id: string;
    name: string;
    confidence: number;
    reason: string;
    matchingFields: string[];
  };
  action: 'link' | 'create_new' | 'review';
}

export interface ImportAnalysis {
  columnMappings: ColumnMapping[];
  dataCleaningSuggestions: DataCleaningSuggestion[];
  matchSuggestions: MatchSuggestion[];
  validationErrors: Array<{
    rowIndex: number;
    field: string;
    error: string;
    severity: 'error' | 'warning';
  }>;
  summary: {
    totalRows: number;
    readyRows: number;
    needsReview: number;
    invalidRows: number;
    detectedType: 'customers' | 'loans' | 'mixed';
  };
}

/**
 * Analyze file structure and suggest column mappings
 */
export async function analyzeColumnMappings(
  headers: string[],
  sampleRows: any[],
  existingCustomers?: any[],
  existingLoans?: any[]
): Promise<ColumnMapping[]> {
  const systemFields = {
    customer: [
      'fullName', 'phone', 'email', 'nrc', 'address', 'employmentStatus',
      'monthlyIncome', 'employer', 'jobTitle'
    ],
    loan: [
      'customerId', 'customerName', 'amount', 'interestRate', 'durationMonths',
      'loanType', 'disbursementDate', 'collateralIncluded'
    ]
  };

  const prompt = `You are an AI assistant supporting a Firebase-backed bulk import system. Your role is to analyze uploaded spreadsheets and suggest column mappings.

File Headers: ${JSON.stringify(headers)}
Sample Data (first 3 rows): ${JSON.stringify(sampleRows.slice(0, 3))}

System Fields Available (ONLY map to these fields - do not create new fields):
Customers: ${systemFields.customer.join(', ')}
Loans: ${systemFields.loan.join(', ')}

IMPORTANT RULES:
- ONLY map to the system fields listed above
- DO NOT map to fields like: amountOwed, amountRepaid, status, createdDate, or any other custom fields
- If a column doesn't match any system field, do NOT include it in the mappings
- Focus on essential fields: fullName, phone, nrc, amount, interestRate, durationMonths
- Ignore columns that represent calculated/derived values (amountOwed, amountRepaid, etc.)
- Ignore audit fields (createdDate, status, etc.) - these are managed by the system

Common mappings:
- phone, mobile, msisdn → phone
- loan_amount, principal, amount → amount (NOT amountOwed or amountRepaid)
- national_id, nrc, id_number → nrc
- full_name, name, customer_name → fullName
- interest_rate, rate → interestRate
- duration, months, term → durationMonths

Return JSON array (ONLY include mappings to valid system fields):
[
  {
    "fileColumn": "column name from file",
    "systemField": "system field name",
    "confidence": 0.0-1.0,
    "explanation": "why this mapping makes sense"
  }
]

Return ONLY valid JSON array, no additional text.`;

  try {
    const response = await callDeepSeekAPI([
      {
        role: 'system',
        content: 'You are an AI assistant supporting a Firebase-backed bulk import system. Your role is to analyze uploaded spreadsheets, clean and normalize data, suggest column mappings and record matches, explain inconsistencies, and flag risks. You do not generate IDs, write to the database, or override system rules. Always respond with valid JSON only.',
      },
      {
        role: 'user',
        content: prompt,
      },
    ], {
      temperature: 0.3,
      maxTokens: 2000,
    });

    // Parse JSON response
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const mappings = JSON.parse(jsonMatch[0]) as ColumnMapping[];
      
      // Filter to only include valid system fields - exclude non-standard fields like amountOwed, amountRepaid, status, createdDate
      const validCustomerFields = ['fullName', 'phone', 'email', 'nrc', 'address', 'employmentStatus', 'monthlyIncome', 'employer', 'jobTitle'];
      const validLoanFields = ['customerId', 'customerName', 'amount', 'interestRate', 'durationMonths', 'loanType', 'disbursementDate', 'collateralIncluded'];
      const allValidFields = [...validCustomerFields, ...validLoanFields];
      
      const filteredMappings = mappings.filter(m => {
        const isValid = m.confidence > 0.3 && allValidFields.includes(m.systemField);
        if (!isValid) {
          console.log(`Filtering out mapping: ${m.fileColumn} → ${m.systemField} (not a valid system field or low confidence)`);
        }
        return isValid;
      });
      
      return filteredMappings;
    }

    // Fallback: simple heuristic matching
    return generateHeuristicMappings(headers);
  } catch (error) {
    console.warn('AI column mapping failed, using heuristics:', error);
    return generateHeuristicMappings(headers);
  }
}

/**
 * Analyze data quality and suggest cleaning
 */
export async function analyzeDataQuality(
  rows: any[],
  columnMappings: ColumnMapping[]
): Promise<DataCleaningSuggestion[]> {
  const prompt = `Analyze this data for cleaning and normalization needs.

Rows: ${JSON.stringify(rows.slice(0, 10))}
Column Mappings: ${JSON.stringify(columnMappings)}

Identify issues like:
- Phone numbers in wrong format (normalize to +260XXXXXXXXX or 0XXXXXXXXX)
- Dates in wrong format (standardize to ISO format)
- Names with extra spaces or inconsistent casing
- Currency values with symbols or commas
- Invalid email formats

Return JSON array:
[
  {
    "rowIndex": 0,
    "field": "phone",
    "originalValue": "+260 97 123 4567",
    "suggestedValue": "+260971234567",
    "reason": "Normalized phone number format",
    "confidence": 0.95
  }
]

Return ONLY valid JSON array.`;

  try {
    const response = await callDeepSeekAPI([
      {
        role: 'system',
        content: 'You are a data quality analyst. Suggest data cleaning and normalization improvements. Always respond with valid JSON only.',
      },
      {
        role: 'user',
        content: prompt,
      },
    ], {
      temperature: 0.2,
      maxTokens: 2000,
    });

    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as DataCleaningSuggestion[];
    }
  } catch (error) {
    console.warn('AI data quality analysis failed:', error);
  }

  return [];
}

/**
 * Suggest matches for existing customers/loans
 */
export async function suggestMatches(
  rows: any[],
  columnMappings: ColumnMapping[],
  existingCustomers: any[],
  existingLoans: any[]
): Promise<MatchSuggestion[]> {
  if (existingCustomers.length === 0 && existingLoans.length === 0) {
    return rows.map((_, idx) => ({
      rowIndex: idx,
      type: 'customer',
      action: 'create_new',
    }));
  }

  const prompt = `Suggest matches between imported rows and existing records.

Sample Rows: ${JSON.stringify(rows.slice(0, 5))}
Column Mappings: ${JSON.stringify(columnMappings)}
Existing Customers (sample): ${JSON.stringify(existingCustomers.slice(0, 10).map(c => ({
  id: c.id,
  fullName: c.fullName,
  phone: c.phone,
  nrc: c.nrc,
  email: c.email,
})))}

For each row, suggest:
1. If it matches an existing customer (by phone, NRC, email, or name similarity)
2. Confidence score (0-1)
3. Reason for match
4. Action: "link" (exact match), "create_new" (no match), or "review" (multiple matches)

Hard matching criteria:
- Exact phone number match
- Exact NRC match
- Exact email match

Soft matching criteria:
- Name similarity (>80%)
- Partial phone match

Return JSON array:
[
  {
    "rowIndex": 0,
    "type": "customer",
    "suggestedMatch": {
      "id": "customer_id",
      "name": "Customer Name",
      "confidence": 0.91,
      "reason": "Exact phone number match + similar name",
      "matchingFields": ["phone", "name"]
    },
    "action": "link"
  }
]

Return ONLY valid JSON array.`;

  try {
    const response = await callDeepSeekAPI([
      {
        role: 'system',
        content: 'You are a data matching assistant. Suggest matches between imported data and existing records. Always respond with valid JSON only.',
      },
      {
        role: 'user',
        content: prompt,
      },
    ], {
      temperature: 0.2,
      maxTokens: 3000,
    });

    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as MatchSuggestion[];
    }
  } catch (error) {
    console.warn('AI match suggestion failed, using rule-based matching:', error);
  }

  // Fallback: rule-based matching
  return generateRuleBasedMatches(rows, columnMappings, existingCustomers);
}

/**
 * Helper function to extract value from row using multiple possible column names
 */
function extractValue(row: any, possibleKeys: string[]): string {
  for (const key of possibleKeys) {
    if (row[key] !== undefined && row[key] !== null && String(row[key]).trim().length > 0) {
      return String(row[key]).trim();
    }
  }
  return '';
}

/**
 * Validate imported data
 */
export function validateImportData(
  rows: any[],
  columnMappings: ColumnMapping[],
  type: 'customers' | 'loans' | 'mixed'
): ImportAnalysis['validationErrors'] {
  const errors: ImportAnalysis['validationErrors'] = [];

  rows.forEach((row, idx) => {
    const mappedRow: any = {};
    columnMappings.forEach(mapping => {
      mappedRow[mapping.systemField] = row[mapping.fileColumn];
    });

    // Helper to get value from either mapped data or original row
    const getValue = (mappedKey: string, originalKeys: string[]): string => {
      if (mappedRow[mappedKey] && String(mappedRow[mappedKey]).trim().length > 0) {
        return String(mappedRow[mappedKey]).trim();
      }
      return extractValue(row, originalKeys);
    };

    if (type === 'customers' || type === 'mixed') {
      // Validate customer fields - check both mapped and original row
      const fullName = getValue('fullName', ['Full Name', 'fullName', 'Name', 'name', 'Customer Name', 'Customer Name']);
      if (!fullName) {
        errors.push({
          rowIndex: idx,
          field: 'fullName',
          error: 'Full name is required',
          severity: 'error',
        });
      }

      const phone = getValue('phone', ['Phone', 'phone', 'Phone Number', 'Mobile', 'mobile', 'MSISDN', 'Tel']);
      if (!phone) {
        errors.push({
          rowIndex: idx,
          field: 'phone',
          error: 'Phone number is required',
          severity: 'error',
        });
      }

      const nrc = getValue('nrc', ['NRC/ID', 'NRC', 'nrc', 'ID Number', 'ID', 'id', 'National ID', 'National ID Number']);
      if (!nrc) {
        errors.push({
          rowIndex: idx,
          field: 'nrc',
          error: 'NRC/ID is required',
          severity: 'error',
        });
      }
    }

    if (type === 'loans' || type === 'mixed') {
      // Validate loan fields - check both mapped and original row
      const amountStr = getValue('amount', ['Amount', 'amount', 'Loan Amount', 'loanAmount', 'Principal', 'principal', 'Loan', 'loan']);
      const amount = parseFloat(amountStr);
      if (!amount || amount <= 0 || isNaN(amount)) {
        errors.push({
          rowIndex: idx,
          field: 'amount',
          error: 'Valid loan amount is required',
          severity: 'error',
        });
      }

      const interestRateStr = getValue('interestRate', ['Interest Rate', 'interestRate', 'Rate', 'rate', 'Interest', 'interest']);
      const interestRate = parseFloat(interestRateStr);
      if (interestRateStr && (interestRate < 0 || interestRate > 100 || isNaN(interestRate))) {
        errors.push({
          rowIndex: idx,
          field: 'interestRate',
          error: 'Interest rate must be between 0 and 100',
          severity: 'warning', // Make this a warning, not an error, as it can have defaults
        });
      }

      const durationStr = getValue('durationMonths', ['Duration (Months)', 'durationMonths', 'Duration', 'duration', 'Months', 'months', 'Term', 'term']);
      const durationMonths = parseInt(durationStr);
      if (!durationMonths || durationMonths <= 0 || isNaN(durationMonths)) {
        errors.push({
          rowIndex: idx,
          field: 'durationMonths',
          error: 'Valid duration (months) is required',
          severity: 'error',
        });
      }
    }
  });

  return errors;
}

/**
 * Generate comprehensive import analysis
 */
export async function analyzeImport(
  headers: string[],
  rows: any[],
  existingCustomers: any[] = [],
  existingLoans: any[] = []
): Promise<ImportAnalysis> {
  // Detect import type
  const detectedType = detectImportType(headers, rows);

  // Analyze column mappings
  const columnMappings = await analyzeColumnMappings(
    headers,
    rows.slice(0, 5),
    existingCustomers,
    existingLoans
  );

  // Analyze data quality
  const dataCleaningSuggestions = await analyzeDataQuality(rows, columnMappings);

  // Suggest matches
  const matchSuggestions = await suggestMatches(
    rows,
    columnMappings,
    existingCustomers,
    existingLoans
  );

  // Validate data
  const validationErrors = validateImportData(rows, columnMappings, detectedType);

  // Classify rows
  const readyRows = rows.filter((_, idx) => {
    const rowErrors = validationErrors.filter(e => e.rowIndex === idx && e.severity === 'error');
    const matchSuggestion = matchSuggestions.find(m => m.rowIndex === idx);
    return rowErrors.length === 0 && matchSuggestion?.action !== 'review';
  }).length;

  const needsReview = rows.filter((_, idx) => {
    const matchSuggestion = matchSuggestions.find(m => m.rowIndex === idx);
    return matchSuggestion?.action === 'review';
  }).length;

  const invalidRows = rows.filter((_, idx) => {
    const rowErrors = validationErrors.filter(e => e.rowIndex === idx && e.severity === 'error');
    return rowErrors.length > 0;
  }).length;

  return {
    columnMappings,
    dataCleaningSuggestions,
    matchSuggestions,
    validationErrors,
    summary: {
      totalRows: rows.length,
      readyRows,
      needsReview,
      invalidRows,
      detectedType,
    },
  };
}

// Helper functions

function detectImportType(headers: string[], rows: any[]): 'customers' | 'loans' | 'mixed' {
  const headerLower = headers.map(h => h.toLowerCase());
  const hasCustomerFields = headerLower.some(h => 
    h.includes('name') || h.includes('phone') || h.includes('nrc') || h.includes('email')
  );
  const hasLoanFields = headerLower.some(h => 
    h.includes('amount') || h.includes('interest') || h.includes('duration') || h.includes('loan')
  );

  if (hasCustomerFields && hasLoanFields) return 'mixed';
  if (hasLoanFields) return 'loans';
  return 'customers';
}

function generateHeuristicMappings(headers: string[]): ColumnMapping[] {
  const mappings: ColumnMapping[] = [];
  
  // Only map to valid system fields - exclude amountOwed, amountRepaid, status, createdDate, etc.
  const patterns: Array<{ pattern: RegExp; field: string; explanation: string }> = [
    // Customer fields
    { pattern: /^(full.?name|name|customer.?name|client.?name|borrower.?name)$/i, field: 'fullName', explanation: 'Matches name field' },
    { pattern: /^(phone|mobile|msisdn|tel|phone.?number|contact.?number)$/i, field: 'phone', explanation: 'Matches phone field' },
    { pattern: /^(email|e.?mail|email.?address)$/i, field: 'email', explanation: 'Matches email field' },
    { pattern: /^(nrc|national.?id|id.?number|nrc.?id|national.?id.?number)$/i, field: 'nrc', explanation: 'Matches NRC/ID field' },
    { pattern: /^(address|location|residence)$/i, field: 'address', explanation: 'Matches address field' },
    { pattern: /^(employer|company|workplace)$/i, field: 'employer', explanation: 'Matches employer field' },
    { pattern: /^(employment.?status|job.?status)$/i, field: 'employmentStatus', explanation: 'Matches employment status' },
    { pattern: /^(monthly.?income|income|salary)$/i, field: 'monthlyIncome', explanation: 'Matches monthly income' },
    { pattern: /^(job.?title|title|position)$/i, field: 'jobTitle', explanation: 'Matches job title' },
    
    // Loan fields - ONLY essential ones
    // Note: Exclude amountOwed, amountRepaid, status, createdDate
    { pattern: /^(amount|loan.?amount|principal|disbursement.?amount)$/i, field: 'amount', explanation: 'Matches loan amount (principal)' },
    { pattern: /^(interest.?rate|rate|interest|interest.?percentage)$/i, field: 'interestRate', explanation: 'Matches interest rate' },
    { pattern: /^(duration|months|term|loan.?duration|duration.?months|loan.?term)$/i, field: 'durationMonths', explanation: 'Matches loan duration' },
    { pattern: /^(loan.?type|type|loan.?category)$/i, field: 'loanType', explanation: 'Matches loan type' },
    { pattern: /^(disbursement.?date|disbursal.?date|start.?date)$/i, field: 'disbursementDate', explanation: 'Matches disbursement date' },
    { pattern: /^(collateral|has.?collateral|collateral.?included)$/i, field: 'collateralIncluded', explanation: 'Matches collateral flag' },
  ];

  headers.forEach(header => {
    const trimmedHeader = header.trim();
    for (const { pattern, field, explanation } of patterns) {
      if (pattern.test(trimmedHeader)) {
        // Avoid duplicate mappings
        if (!mappings.some(m => m.fileColumn === header && m.systemField === field)) {
          mappings.push({
            fileColumn: header,
            systemField: field,
            confidence: 0.8,
            explanation,
          });
        }
        break;
      }
    }
  });

  return mappings;
}

function generateRuleBasedMatches(
  rows: any[],
  columnMappings: ColumnMapping[],
  existingCustomers: any[]
): MatchSuggestion[] {
  return rows.map((row, idx) => {
    const mappedRow: any = {};
    columnMappings.forEach(mapping => {
      mappedRow[mapping.systemField] = row[mapping.fileColumn];
    });

    // Try to find matches
    const phone = normalizePhone(String(mappedRow.phone || ''));
    const nrc = String(mappedRow.nrc || '').trim();
    const email = String(mappedRow.email || '').trim().toLowerCase();
    const name = String(mappedRow.fullName || '').trim().toLowerCase();

    // Hard matches
    for (const customer of existingCustomers) {
      const customerPhone = normalizePhone(String(customer.phone || ''));
      const customerNrc = String(customer.nrc || '').trim();
      const customerEmail = String(customer.email || '').trim().toLowerCase();

      if (phone && customerPhone && phone === customerPhone) {
        return {
          rowIndex: idx,
          type: 'customer',
          suggestedMatch: {
            id: customer.id,
            name: customer.fullName || 'Unknown',
            confidence: 0.95,
            reason: 'Exact phone number match',
            matchingFields: ['phone'],
          },
          action: 'link',
        };
      }

      if (nrc && customerNrc && nrc === customerNrc) {
        return {
          rowIndex: idx,
          type: 'customer',
          suggestedMatch: {
            id: customer.id,
            name: customer.fullName || 'Unknown',
            confidence: 0.95,
            reason: 'Exact NRC match',
            matchingFields: ['nrc'],
          },
          action: 'link',
        };
      }

      if (email && customerEmail && email === customerEmail) {
        return {
          rowIndex: idx,
          type: 'customer',
          suggestedMatch: {
            id: customer.id,
            name: customer.fullName || 'Unknown',
            confidence: 0.9,
            reason: 'Exact email match',
            matchingFields: ['email'],
          },
          action: 'link',
        };
      }
    }

    // Soft match by name similarity
    if (name) {
      const similarCustomers = existingCustomers.filter(c => {
        const customerName = String(c.fullName || '').trim().toLowerCase();
        return calculateSimilarity(name, customerName) > 0.8;
      });

      if (similarCustomers.length === 1) {
        return {
          rowIndex: idx,
          type: 'customer',
          suggestedMatch: {
            id: similarCustomers[0].id,
            name: similarCustomers[0].fullName || 'Unknown',
            confidence: 0.75,
            reason: 'High name similarity',
            matchingFields: ['name'],
          },
          action: 'review',
        };
      } else if (similarCustomers.length > 1) {
        return {
          rowIndex: idx,
          type: 'customer',
          action: 'review',
        };
      }
    }

    return {
      rowIndex: idx,
      type: 'customer',
      action: 'create_new',
    };
  });
}

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '').replace(/^260/, '').replace(/^0/, '');
}

function calculateSimilarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  if (longer.length === 0) return 1.0;
  const distance = levenshteinDistance(longer, shorter);
  return (longer.length - distance) / longer.length;
}

function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[str2.length][str1.length];
}

