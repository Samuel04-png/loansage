/**
 * Multi-Section CSV Splitter
 * Handles Nenji-export and other dump files with multiple data sections
 * Detects sections marked with === SECTION_NAME === headers
 */

export interface CSVSection {
  name: string;
  headers: string[];
  rows: string[][];
  startLine: number;
  endLine: number;
  rowCount: number;
}

export interface SplitResult {
  sections: CSVSection[];
  hasSections: boolean;
  totalRows: number;
}

/**
 * Detect and split multi-section CSV dump files
 * Example format:
 * === BORROWERS ===
 * Name,Phone,Email
 * John,0971234567,john@email.com
 * 
 * === LOANS ===
 * LoanID,Amount,Status
 * 123,5000,pending
 */
export function splitMultiSectionCSV(content: string): SplitResult {
  const lines = content.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  const sections: CSVSection[] = [];
  let currentSection: {
    name: string;
    headers: string[];
    rows: string[][];
    startLine: number;
  } | null = null;

  // Regex to detect section headers: === SECTION_NAME ===
  const sectionHeaderRegex = /^===\s*(\w+(?:\s+\w+)*)\s*===$/i;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const headerMatch = line.match(sectionHeaderRegex);

    if (headerMatch) {
      // Save previous section if exists
      if (currentSection) {
        sections.push({
          name: currentSection.name,
          headers: currentSection.headers,
          rows: currentSection.rows,
          startLine: currentSection.startLine,
          endLine: i - 1,
          rowCount: currentSection.rows.length,
        });
      }

      // Start new section
      currentSection = {
        name: headerMatch[1].toUpperCase(),
        headers: [],
        rows: [],
        startLine: i + 1,
      };
    } else if (currentSection) {
      // Process data in current section
      if (currentSection.headers.length === 0) {
        // First non-header line is the CSV header row
        currentSection.headers = parseCSVLine(line);
      } else {
        // Parse data row
        const row = parseCSVLine(line);
        if (row.length > 0) {
          currentSection.rows.push(row);
        }
      }
    }
  }

  // Save final section
  if (currentSection && currentSection.headers.length > 0) {
    sections.push({
      name: currentSection.name,
      headers: currentSection.headers,
      rows: currentSection.rows,
      startLine: currentSection.startLine,
      endLine: lines.length - 1,
      rowCount: currentSection.rows.length,
    });
  }

  const hasSections = sections.length > 1;
  const totalRows = sections.reduce((sum, s) => sum + s.rowCount, 0);

  return {
    sections,
    hasSections,
    totalRows,
  };
}

/**
 * Parse a CSV line handling quoted values with commas
 * Properly handles:
 * - Double quotes inside quoted strings: "value with ""quotes"""
 * - Commas inside quoted strings: "address, with comma"
 */
export function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  let i = 0;

  while (i < line.length) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        current += '"';
        i += 2;
      } else {
        // Toggle quote mode
        inQuotes = !inQuotes;
        i++;
      }
    } else if (char === ',' && !inQuotes) {
      // Field separator
      result.push(current.trim());
      current = '';
      i++;
    } else {
      current += char;
      i++;
    }
  }

  // Add final field
  if (current.length > 0 || line.endsWith(',')) {
    result.push(current.trim());
  }

  return result;
}

/**
 * Detect which section type based on headers
 * Returns: 'borrowers', 'loans', 'branches', or 'unknown'
 */
export function detectSectionType(
  sectionName: string,
  headers: string[]
): 'borrowers' | 'loans' | 'branches' | 'unknown' {
  const lowerName = sectionName.toLowerCase();
  const lowerHeaders = headers.map(h => h.toLowerCase());

  // Check section name first
  if (
    lowerName.includes('borrower') ||
    lowerName.includes('customer') ||
    lowerName.includes('person')
  ) {
    return 'borrowers';
  }

  if (lowerName.includes('loan')) {
    return 'loans';
  }

  if (lowerName.includes('branch') || lowerName.includes('location')) {
    return 'branches';
  }

  // Check headers as fallback
  const hasBorrowerFields =
    lowerHeaders.some(h => h.includes('name') || h.includes('phone')) &&
    lowerHeaders.some(h => h.includes('email') || h.includes('id'));

  const hasLoanFields = lowerHeaders.some(h => h.includes('amount')) &&
    lowerHeaders.some(h =>
      h.includes('rate') ||
      h.includes('interest') ||
      h.includes('duration') ||
      h.includes('term')
    );

  const hasBranchFields =
    lowerHeaders.some(h => h.includes('branch')) &&
    lowerHeaders.some(h => h.includes('location') || h.includes('address'));

  if (hasBorrowerFields) return 'borrowers';
  if (hasLoanFields) return 'loans';
  if (hasBranchFields) return 'branches';

  return 'unknown';
}

/**
 * Get human-readable description for a CSV section
 */
export function getSectionDescription(section: CSVSection): string {
  const type = detectSectionType(section.name, section.headers);
  const rowsText = section.rowCount === 1 ? 'row' : 'rows';

  switch (type) {
    case 'borrowers':
      return `Borrowers - ${section.rowCount} ${rowsText}`;
    case 'loans':
      return `Loans - ${section.rowCount} ${rowsText}`;
    case 'branches':
      return `Branches - ${section.rowCount} ${rowsText}`;
    default:
      return `${section.name} - ${section.rowCount} ${rowsText}`;
  }
}

/**
 * Convert section back to CSV format for processing
 */
export function sectionToCSV(section: CSVSection): string {
  const headerLine = section.headers.map(h => escapeCSVValue(h)).join(',');
  const dataLines = section.rows.map(row =>
    row.map(val => escapeCSVValue(val)).join(',')
  );

  return [headerLine, ...dataLines].join('\n');
}

/**
 * Escape CSV value for safe export
 */
function escapeCSVValue(value: string): string {
  if (!value) return '""';
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
