/**
 * Section Splitter for Multi-Section CSV Files
 * Handles files with section delimiters like === BORROWERS ===, === BRANCHES ===
 */

export interface FileSection {
  sectionName: string;
  sectionType: 'borrowers' | 'customers' | 'branches' | 'loans' | 'transactions' | 'unknown';
  headers: string[];
  rows: any[];
  rawText: string;
  lineStart: number;
  lineEnd: number;
}

/**
 * Detect and split multi-section CSV file into separate sections
 */
export function splitFileIntoSections(rawText: string): FileSection[] {
  const sections: FileSection[] = [];
  const lines = rawText.split('\n');
  
  let currentSection: FileSection | null = null;
  let currentHeaders: string[] = [];
  let currentRows: any[] = [];
  let sectionStartLine = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Check if line is a section delimiter (e.g., === BORROWERS ===)
    const sectionMatch = line.match(/^===?\s*(.+?)\s*===?$/i);
    
    if (sectionMatch) {
      // Save previous section if it exists
      if (currentSection && currentHeaders.length > 0) {
        sections.push({
          ...currentSection,
          headers: currentHeaders,
          rows: currentRows,
          lineEnd: i - 1,
        });
      }
      
      // Start new section
      const sectionName = sectionMatch[1].trim();
      const sectionType = detectSectionType(sectionName);
      
      currentSection = {
        sectionName,
        sectionType,
        headers: [],
        rows: [],
        rawText: '',
        lineStart: i,
        lineEnd: i,
      };
      
      currentHeaders = [];
      currentRows = [];
      sectionStartLine = i;
      continue;
    }
    
    // If we're in a section, process the line
    if (currentSection) {
      // Check if this is a header line (first non-empty line after section marker)
      if (currentHeaders.length === 0 && line.length > 0 && !line.startsWith('===')) {
        // Parse header
        currentHeaders = parseCSVLine(line);
        continue;
      }
      
      // If we have headers, this is a data row
      if (currentHeaders.length > 0 && line.length > 0) {
        const values = parseCSVLine(line);
        
        // Skip rows that are too short or are section markers
        if (values.length >= currentHeaders.length / 2 && !line.match(/^===/)) {
          const row: any = {};
          currentHeaders.forEach((header, index) => {
            row[header] = values[index]?.trim().replace(/^"|"$/g, '') || '';
            // Also store normalized version
            const normalized = header.toLowerCase().trim().replace(/\s+/g, '');
            row[normalized] = values[index]?.trim().replace(/^"|"$/g, '') || '';
          });
          currentRows.push(row);
        }
      }
    } else if (sections.length === 0) {
      // No section markers found - treat entire file as single section
      // This will be handled after the loop
      break;
    }
  }
  
  // Handle last section or file without section markers
  if (currentSection && currentHeaders.length > 0) {
    sections.push({
      ...currentSection,
      headers: currentHeaders,
      rows: currentRows,
      lineEnd: lines.length - 1,
      rawText: lines.slice(sectionStartLine).join('\n'),
    });
  } else if (sections.length === 0) {
    // No sections found - treat as single section with auto-detection
    const parsed = parseSingleSection(rawText);
    if (parsed.headers.length > 0) {
      sections.push({
        sectionName: 'Main Data',
        sectionType: detectSectionTypeFromHeaders(parsed.headers),
        headers: parsed.headers,
        rows: parsed.rows,
        rawText,
        lineStart: 0,
        lineEnd: lines.length - 1,
      });
    }
  }
  
  return sections;
}

/**
 * Detect section type from section name
 */
function detectSectionType(sectionName: string): FileSection['sectionType'] {
  const name = sectionName.toLowerCase();
  
  if (name.includes('borrower') || name.includes('customer')) {
    return 'customers';
  }
  if (name.includes('branch')) {
    return 'branches';
  }
  if (name.includes('loan')) {
    return 'loans';
  }
  if (name.includes('transaction') || name.includes('payment')) {
    return 'transactions';
  }
  
  return 'unknown';
}

/**
 * Detect section type from headers
 */
function detectSectionTypeFromHeaders(headers: string[]): FileSection['sectionType'] {
  const headerStr = headers.join(' ').toLowerCase();
  
  if (headerStr.includes('borrower') || headerStr.includes('customer') || 
      headerStr.includes('name') && (headerStr.includes('phone') || headerStr.includes('nrc'))) {
    return 'customers';
  }
  if (headerStr.includes('loan') && (headerStr.includes('amount') || headerStr.includes('interest'))) {
    return 'loans';
  }
  if (headerStr.includes('branch')) {
    return 'branches';
  }
  if (headerStr.includes('transaction') || headerStr.includes('payment')) {
    return 'transactions';
  }
  
  return 'unknown';
}

/**
 * Parse a single CSV line with proper quote handling
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];
    
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        current += '"';
        i++; // Skip next quote
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // Field separator
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  // Add last field
  result.push(current.trim());
  return result;
}

/**
 * Parse single section CSV (when no section markers found)
 */
function parseSingleSection(csvText: string): { headers: string[]; rows: any[] } {
  const lines = csvText.split('\n').filter(line => line.trim());
  if (lines.length === 0) return { headers: [], rows: [] };
  
  const headers = parseCSVLine(lines[0]);
  const rows = lines.slice(1).map(line => {
    const values = parseCSVLine(line);
    const row: any = {};
    headers.forEach((header, index) => {
      const cleanHeader = header.trim().replace(/^"|"$/g, '');
      const normalized = cleanHeader.toLowerCase().trim().replace(/\s+/g, '');
      row[cleanHeader] = values[index]?.trim().replace(/^"|"$/g, '') || '';
      row[normalized] = values[index]?.trim().replace(/^"|"$/g, '') || '';
    });
    return row;
  }).filter(row => {
    // Filter out completely empty rows
    return Object.values(row).some(val => val !== '');
  });
  
  return { headers, rows };
}
