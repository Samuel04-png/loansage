/**
 * Data Normalization Utilities
 * Clean and standardize phone numbers, emails, addresses, and other fields
 */

export interface NormalizedData {
  phone?: string;
  email?: string;
  fullName?: string;
  address?: string;
  nrc?: string;
  originalData: Record<string, any>;
  confidence: number; // 0-1, how confident we are in the normalization
  warnings: string[];
}

/**
 * Normalize phone numbers to +260XXXXXXXXX format
 * Handles: 097..., 077..., +260..., 0970842495 (in email), etc.
 */
export function normalizePhone(phone: string | undefined | null): string | null {
  if (!phone) return null;
  
  let cleaned = String(phone).trim();
  
  // Remove all non-digit characters except +
  cleaned = cleaned.replace(/[^\d+]/g, '');
  
  // Handle different formats
  if (cleaned.startsWith('+260')) {
    // Already in international format
    if (cleaned.length === 13) {
      return cleaned; // +260XXXXXXXXX
    }
  } else if (cleaned.startsWith('260') && cleaned.length === 12) {
    // 260XXXXXXXXX format (missing +)
    return `+${cleaned}`;
  } else if (cleaned.match(/^0[67]\d{8}$/)) {
    // 097XXXXXXXX or 077XXXXXXXX format
    return `+260${cleaned.slice(1)}`; // Remove leading 0, add +260
  } else if (cleaned.match(/^[67]\d{8}$/)) {
    // 97XXXXXXXX or 77XXXXXXXX format (missing leading 0)
    return `+260${cleaned}`;
  } else if (cleaned.length === 9 && cleaned.match(/^[67]\d{8}$/)) {
    // 9 digits starting with 6 or 7
    return `+260${cleaned}`;
  }
  
  // If we can't normalize, return null
  return null;
}

/**
 * Extract phone number from email if email contains phone
 * Example: danny0970842495sakala@gmail.com -> email: danny.sakala@gmail.com, phone: 0970842495
 */
export function extractPhoneFromEmail(email: string): { email: string; phone: string | null } {
  if (!email) return { email: '', phone: null };
  
  // Look for phone number patterns in email
  const phonePatterns = [
    /(\+?260[67]\d{8})/g,  // +26097... or 26097...
    /(0?[67]\d{8})/g,      // 097... or 97...
  ];
  
  let cleanedEmail = email;
  let extractedPhone: string | null = null;
  
  for (const pattern of phonePatterns) {
    const matches = email.match(pattern);
    if (matches && matches.length > 0) {
      // Take the first match
      extractedPhone = normalizePhone(matches[0]);
      // Remove the phone number from email
      cleanedEmail = cleanedEmail.replace(pattern, '');
      break;
    }
  }
  
  // Clean up email (remove double dots, fix spacing)
  cleanedEmail = cleanedEmail
    .replace(/\.+/g, '.')  // Multiple dots to single dot
    .replace(/@\./g, '@')  // @. to @
    .replace(/\.@/g, '@')  // .@ to @
    .trim();
  
  return {
    email: cleanedEmail || email, // Fallback to original if cleaning broke it
    phone: extractedPhone,
  };
}

/**
 * Normalize email address
 */
export function normalizeEmail(email: string | undefined | null): string | null {
  if (!email) return null;
  
  let cleaned = String(email).trim().toLowerCase();
  
  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  // Check if it's a valid email format
  if (emailRegex.test(cleaned)) {
    return cleaned;
  }
  
  // Try to fix common issues
  cleaned = cleaned
    .replace(/\s+/g, '')  // Remove spaces
    .replace(/\.{2,}/g, '.')  // Multiple dots to single
    .replace(/@\./g, '@')
    .replace(/\.@/g, '@');
  
  if (emailRegex.test(cleaned)) {
    return cleaned;
  }
  
  return null;
}

/**
 * Normalize full name
 */
export function normalizeFullName(name: string | undefined | null): string | null {
  if (!name) return null;
  
  let cleaned = String(name).trim();
  
  // Capitalize first letter of each word
  cleaned = cleaned
    .split(/\s+/)
    .map(word => {
      if (word.length === 0) return '';
      return word[0].toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
  
  return cleaned || null;
}

/**
 * Normalize NRC (National Registration Card) number
 */
export function normalizeNRC(nrc: string | undefined | null): string | null {
  if (!nrc) return null;
  
  let cleaned = String(nrc).trim().toUpperCase();
  
  // Remove common separators and normalize
  cleaned = cleaned.replace(/[-\s]/g, '');
  
  // Basic validation - NRC typically has specific format
  // Adjust based on your country's NRC format
  if (cleaned.length >= 8 && cleaned.length <= 20) {
    return cleaned;
  }
  
  return cleaned || null;
}

/**
 * Normalize address (preserve commas inside quotes)
 */
export function normalizeAddress(address: string | undefined | null): string | null {
  if (!address) return null;
  
  let cleaned = String(address).trim();
  
  // Remove excessive whitespace
  cleaned = cleaned.replace(/\s+/g, ' ');
  
  // If address contains quoted sections, preserve them
  if (cleaned.includes('"')) {
    // Address is already quoted - return as is
    return cleaned;
  }
  
  return cleaned || null;
}

/**
 * Comprehensive data normalization
 * Takes raw row data and returns normalized version with confidence score
 */
export function normalizeRowData(
  row: Record<string, any>,
  fieldMappings: {
    phone?: string[];
    email?: string[];
    fullName?: string[];
    nrc?: string[];
    address?: string[];
  }
): NormalizedData {
  const warnings: string[] = [];
  const normalized: NormalizedData = {
    originalData: { ...row },
    confidence: 1.0,
    warnings: [],
  };
  
  // Helper to find value by multiple possible keys
  const findValue = (keys: string[]): string | null => {
    for (const key of keys) {
      const value = row[key] || row[key.toLowerCase()] || row[key.toUpperCase()];
      if (value && String(value).trim()) {
        return String(value).trim();
      }
    }
    return null;
  };
  
  // Normalize phone
  const phoneKeys = fieldMappings.phone || ['phone', 'mobile', 'phoneNumber', 'contact', 'tel'];
  const phoneRaw = findValue(phoneKeys);
  let phone = normalizePhone(phoneRaw);
  
  // Normalize email (and extract phone if needed)
  const emailKeys = fieldMappings.email || ['email', 'emailAddress', 'eMail'];
  let emailRaw = findValue(emailKeys);
  let email = normalizeEmail(emailRaw);
  
  // If email contains phone number, extract it
  if (emailRaw && !phone) {
    const extracted = extractPhoneFromEmail(emailRaw);
    if (extracted.phone) {
      phone = extracted.phone;
      email = normalizeEmail(extracted.email);
      warnings.push('Phone number extracted from email field');
    }
  }
  
  // If we found phone in email, update confidence
  if (!phoneRaw && phone) {
    normalized.confidence *= 0.9; // Slightly lower confidence if extracted from email
  }
  
  // Normalize full name
  const nameKeys = fieldMappings.fullName || ['name', 'fullName', 'customerName', 'borrowerName', 'full_name'];
  const nameRaw = findValue(nameKeys);
  const fullName = normalizeFullName(nameRaw);
  
  // Normalize NRC
  const nrcKeys = fieldMappings.nrc || ['nrc', 'nrcNumber', 'idNumber', 'nationalId', 'id'];
  const nrcRaw = findValue(nrcKeys);
  const nrc = normalizeNRC(nrcRaw);
  
  // Normalize address
  const addressKeys = fieldMappings.address || ['address', 'location', 'residence', 'homeAddress'];
  const addressRaw = findValue(addressKeys);
  const address = normalizeAddress(addressRaw);
  
  // Assign normalized values
  if (phone) normalized.phone = phone;
  if (email) normalized.email = email;
  if (fullName) normalized.fullName = fullName;
  if (nrc) normalized.nrc = nrc;
  if (address) normalized.address = address;
  
  // Calculate confidence based on critical fields
  let confidence = 1.0;
  if (!fullName) confidence *= 0.7; // Name is critical
  if (!phone && !nrc) confidence *= 0.6; // Need at least one identifier
  if (email && !normalizeEmail(email)) confidence *= 0.9; // Invalid email format
  
  normalized.confidence = confidence;
  normalized.warnings = warnings;
  
  return normalized;
}

/**
 * Validate if normalized data has minimum required fields
 */
export function validateNormalizedData(
  normalized: NormalizedData,
  requiredFields: ('phone' | 'email' | 'fullName' | 'nrc')[] = ['fullName', 'phone']
): { isValid: boolean; missingFields: string[] } {
  const missingFields: string[] = [];
  
  for (const field of requiredFields) {
    if (!normalized[field] || String(normalized[field]).trim() === '') {
      missingFields.push(field);
    }
  }
  
  return {
    isValid: missingFields.length === 0,
    missingFields,
  };
}
