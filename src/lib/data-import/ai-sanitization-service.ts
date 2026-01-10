/**
 * AI-Powered Data Sanitization Layer
 * Cleans and normalizes messy CSV data from dumps like Nenji-export
 */

export interface SanitizationResult {
  value: string;
  isModified: boolean;
  warnings: string[];
  extractions?: {
    phone?: string;
    email?: string;
  };
}

export interface RowSanitizationResult {
  rowIndex: number;
  originalData: Record<string, string>;
  cleanedData: Record<string, string>;
  issues: Array<{
    field: string;
    originalValue: string;
    cleanedValue: string;
    issue: string;
  }>;
  isValid: boolean;
  errors: string[];
}

/**
 * Normalize phone numbers to +260XXXXXXXXX format
 * Handles: 097..., 077..., +260..., 260..., etc.
 */
export function normalizePhoneNumber(phone: any): SanitizationResult {
  try {
    // Defensive: Convert to string and handle null/undefined
    const phoneStr = String(phone || '').trim();
    if (!phoneStr || phoneStr === 'undefined' || phoneStr === 'null') {
      return { value: '', isModified: false, warnings: ['Empty phone number'] };
    }

    const result: SanitizationResult = {
      value: phoneStr,
      isModified: false,
      warnings: [],
    };

    // Remove all non-digit characters except +
    let cleaned = phoneStr.replace(/[^\d+]/g, '');

    // Handle various formats
    if (cleaned.startsWith('+260')) {
      // Already in correct format
      if (cleaned.length === 13) {
        result.value = cleaned;
        return result;
      }
    } else if (cleaned.startsWith('260')) {
      // Remove country code prefix if full number
      if (cleaned.length === 12) {
        cleaned = '+' + cleaned;
        result.value = cleaned;
        result.isModified = true;
        return result;
      }
    } else if (cleaned.startsWith('0')) {
      // Zambian format: 0971234567 or 0771234567
      if (cleaned.length === 10) {
        cleaned = '+260' + cleaned.substring(1);
        result.value = cleaned;
        result.isModified = true;
        return result;
      }
    } else if (cleaned.match(/^7\d{8}$/) || cleaned.match(/^9\d{8}$/)) {
      // Format: 971234567 or 771234567
      cleaned = '+260' + cleaned;
      result.value = cleaned;
      result.isModified = true;
      return result;
    }

    // If nothing matched, try to extract 10 digits and format
    const digits = cleaned.replace(/\D/g, '');
    if (digits.length === 10 && (digits.startsWith('0') || digits.startsWith('7') || digits.startsWith('9'))) {
      const formatted = '+260' + (digits.startsWith('0') ? digits.substring(1) : digits);
      result.value = formatted;
      result.isModified = true;
      result.warnings.push('Phone number reformatted from non-standard format');
      return result;
    } else if (digits.length === 12 && digits.startsWith('260')) {
      result.value = '+' + digits;
      result.isModified = true;
      return result;
    }

    // Invalid format
    result.value = phoneStr;
    result.warnings.push('Phone number could not be normalized - format not recognized');
    return result;
  } catch (error) {
    console.error('Error normalizing phone:', error);
    return { value: '', isModified: false, warnings: ['Error processing phone number'] };
  }
}

/**
 * Detect if email field contains a phone number
 * Returns extracted phone and cleaned email
 */
export function extractPhoneFromEmail(email: any): SanitizationResult {
  try {
    // Defensive: Convert to string and handle null/undefined
    const emailStr = String(email || '').trim();
    if (!emailStr || emailStr === 'undefined' || emailStr === 'null') {
      return { value: emailStr, isModified: false, warnings: [] };
    }

    const result: SanitizationResult = {
      value: emailStr,
      isModified: false,
      warnings: [],
      extractions: {},
    };

    // Look for phone number patterns in email
    // Patterns: 09XXXXXXXX, 07XXXXXXXX, +260XXXXXXXXX, 260XXXXXXXXX
    const phonePattern = /(\+?260\d{9}|\d{9,12})/g;
    const matches = emailStr.match(phonePattern);

    if (matches && matches.length > 0) {
      // Extract the phone number
      const extractedPhone = matches[0];
      result.extractions!.phone = extractedPhone;

      // Try to clean the email by removing the phone
      const cleaned = emailStr
        .replace(phonePattern, '')
        .replace(/[_-]+/g, '') // Remove extra separators
        .replace(/[\s.]+/g, '.') // Normalize dots
        .replace(/\.{2,}/g, '.') // Remove double dots
        .replace(/^\.+|\.+$/g, ''); // Remove leading/trailing dots

      // Validate the cleaned email
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (emailPattern.test(cleaned) && !cleaned.includes(extractedPhone)) {
        result.value = cleaned;
        result.isModified = true;
        result.warnings.push(`Phone number extracted from email field: ${extractedPhone}`);
        return result;
      }
    }

    // Check if the entire string looks like a phone number
    const allDigits = emailStr.replace(/\D/g, '');
    if (allDigits.length >= 9 && allDigits.length <= 12) {
      result.extractions!.phone = emailStr;
      result.value = emailStr;
      result.warnings.push('Email field appears to be a phone number');
      return result;
    }

    return result;
  } catch (error) {
    console.error('Error extracting phone from email:', error);
    return { value: '', isModified: false, warnings: ['Error processing email'] };
  }
}

/**
 * Normalize email address
 * Removes spaces, converts to lowercase, etc.
 */
export function normalizeEmail(email: any): SanitizationResult {
  try {
    // Defensive: Convert to string and handle null/undefined
    const emailStr = String(email || '').trim();
    if (!emailStr || emailStr === 'undefined' || emailStr === 'null') {
      return { value: '', isModified: false, warnings: ['Empty email'] };
    }

    const result: SanitizationResult = {
      value: emailStr,
      isModified: false,
      warnings: [],
    };

    // First check if it contains a phone number
    const phoneCheck = extractPhoneFromEmail(emailStr);
    if (phoneCheck.extractions?.phone && phoneCheck.isModified) {
      result.extractions = phoneCheck.extractions;
    }

    // Normalize
    let cleaned = emailStr
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ''); // Remove all spaces

    // Basic email validation
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(cleaned)) {
      result.warnings.push('Email format is invalid');
    }

    if (cleaned !== emailStr.toLowerCase().trim()) {
      result.isModified = true;
    }

    result.value = cleaned;
    return result;
  } catch (error) {
    console.error('Error normalizing email:', error);
    return { value: '', isModified: false, warnings: ['Error processing email'] };
  }
}

/**
 * Handle CSV address fields with quoted commas
 * Properly extracts full address even with commas
 */
export function normalizeAddress(address: any): SanitizationResult {
  try {
    // Defensive: Convert to string and handle null/undefined
    const addressStr = String(address || '').trim();
    if (!addressStr || addressStr === 'undefined' || addressStr === 'null') {
      return { value: '', isModified: false, warnings: ['Empty address'] };
    }

    const result: SanitizationResult = {
      value: addressStr,
      isModified: false,
      warnings: [],
    };

    // Remove extra whitespace
    let cleaned = addressStr
      .trim()
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/^"+|"+$/g, ''); // Remove surrounding quotes

    // Fix common issues
    if (cleaned !== addressStr) {
      result.isModified = true;
    }

    result.value = cleaned;
    return result;
  } catch (error) {
    console.error('Error normalizing address:', error);
    return { value: '', isModified: false, warnings: ['Error processing address'] };
  }
}

/**
 * Sanitize a complete row of data
 */
export function sanitizeRow(
  rowIndex: number,
  data: Record<string, string>,
  columnMappings: Record<string, string> // Maps CSV column to data type (phone, email, name, etc.)
): RowSanitizationResult {
  const result: RowSanitizationResult = {
    rowIndex,
    originalData: { ...data },
    cleanedData: { ...data },
    issues: [],
    isValid: true,
    errors: [],
  };

  // Track extracted phone numbers
  const extractedPhones: string[] = [];
  const phoneField = Object.entries(columnMappings).find(([_, type]) => type === 'phone')?.[0];
  const emailField = Object.entries(columnMappings).find(([_, type]) => type === 'email')?.[0];

  // Process each field
  for (const [field, value] of Object.entries(data)) {
    const fieldType = columnMappings[field] || 'unknown';

    if (fieldType === 'phone' && value) {
      const sanitized = normalizePhoneNumber(value);
      if (sanitized.isModified) {
        result.issues.push({
          field,
          originalValue: value,
          cleanedValue: sanitized.value,
          issue: sanitized.warnings.join('; '),
        });
        result.cleanedData[field] = sanitized.value;
      }
    } else if (fieldType === 'email' && value) {
      const sanitized = normalizeEmail(value);
      if (sanitized.isModified) {
        result.issues.push({
          field,
          originalValue: value,
          cleanedValue: sanitized.value,
          issue: sanitized.warnings.join('; '),
        });
        result.cleanedData[field] = sanitized.value;

        // Extract phone from email if found
        if (sanitized.extractions?.phone && phoneField) {
          extractedPhones.push(sanitized.extractions.phone);
        }
      }
    } else if (fieldType === 'address' && value) {
      const sanitized = normalizeAddress(value);
      if (sanitized.isModified) {
        result.issues.push({
          field,
          originalValue: value,
          cleanedValue: sanitized.value,
          issue: 'Address normalized',
        });
        result.cleanedData[field] = sanitized.value;
      }
    } else if (fieldType === 'name' && value) {
      const cleaned = value.trim();
      if (cleaned !== value) {
        result.issues.push({
          field,
          originalValue: value,
          cleanedValue: cleaned,
          issue: 'Whitespace normalized',
        });
        result.cleanedData[field] = cleaned;
      }
    }
  }

  // If phone was extracted from email, populate phone field if empty
  if (extractedPhones.length > 0 && phoneField && !result.cleanedData[phoneField]) {
    result.cleanedData[phoneField] = extractedPhones[0];
    result.issues.push({
      field: phoneField,
      originalValue: '',
      cleanedValue: extractedPhones[0],
      issue: `Phone extracted from ${emailField}`,
    });
  }

  // Validate required fields
  const nameField = Object.entries(columnMappings).find(([_, type]) => type === 'name')?.[0];
  if (nameField && !result.cleanedData[nameField]) {
    result.errors.push(`Missing required field: ${nameField}`);
    result.isValid = false;
  }

  return result;
}

/**
 * Batch sanitize multiple rows
 */
export function sanitizeRows(
  rows: Array<Record<string, string>>,
  columnMappings: Record<string, string>
): {
  cleanedRows: RowSanitizationResult[];
  validRows: RowSanitizationResult[];
  invalidRows: RowSanitizationResult[];
  totalIssues: number;
} {
  const cleanedRows = rows.map((row, index) =>
    sanitizeRow(index + 1, row, columnMappings)
  );

  const validRows = cleanedRows.filter(r => r.isValid);
  const invalidRows = cleanedRows.filter(r => !r.isValid);
  const totalIssues = cleanedRows.reduce((sum, r) => sum + r.issues.length, 0);

  return {
    cleanedRows,
    validRows,
    invalidRows,
    totalIssues,
  };
}
