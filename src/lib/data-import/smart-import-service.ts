/**
 * Smart AI Import Service
 * Integrates section splitting, AI cleaning, and quarantine workflow
 */

import { splitFileIntoSections, FileSection } from './section-splitter';
import { cleanRowsBatch, shouldQuarantineRow, AICleaningResult } from './ai-cleaning-service';
import { normalizeRowData } from './data-normalization';
import { quarantineRowsBatch, getQuarantinedRows } from './quarantine-system';
import { executeBulkImport } from './bulk-import-service';
import type { ImportRow, BulkImportResult } from './bulk-import-service';

export interface SmartImportOptions {
  useAI?: boolean;
  confidenceThreshold?: number;
  autoApprove?: boolean; // Auto-approve rows above confidence threshold
  quarantineEnabled?: boolean;
  fieldMappings?: {
    phone?: string[];
    email?: string[];
    fullName?: string[];
    nrc?: string[];
    address?: string[];
  };
}

export interface SmartImportResult extends BulkImportResult {
  quarantined: number;
  quarantinedRowIds: string[];
  sections: Array<{
    sectionName: string;
    sectionType: string;
    rowsProcessed: number;
    rowsQuarantined: number;
  }>;
  aiStats: {
    rowsCleaned: number;
    rowsNeedingReview: number;
    averageConfidence: number;
  };
}

/**
 * Smart import with AI preprocessing
 */
/**
 * Detect import type from sections or headers
 */
function detectImportType(sections: FileSection[]): 'customers' | 'loans' | 'mixed' {
  if (sections.length === 0) return 'customers';
  
  const sectionTypes = sections.map(s => s.sectionType);
  
  if (sectionTypes.some(t => t === 'customers' || t === 'borrowers')) {
    if (sectionTypes.some(t => t === 'loans')) {
      return 'mixed';
    }
    return 'customers';
  }
  
  if (sectionTypes.some(t => t === 'loans')) {
    return 'loans';
  }
  
  // Default based on first section headers
  const firstSection = sections[0];
  const headersStr = firstSection.headers.join(' ').toLowerCase();
  if (headersStr.includes('amount') && headersStr.includes('interest')) {
    return 'loans';
  }
  
  return 'customers';
}

export async function executeSmartImport(
  file: File,
  agencyId: string,
  userId: string,
  type: 'customers' | 'loans' | 'mixed' = 'customers',
  options: SmartImportOptions = {}
): Promise<SmartImportResult> {
  const {
    useAI = true,
    confidenceThreshold = 0.7,
    autoApprove = false,
    quarantineEnabled = true,
    fieldMappings = {},
  } = options;

  // Step 1: Read file as text for section detection
  const fileText = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });

  // Step 2: Split file into sections (if multi-section format)
  const sections = splitFileIntoSections(fileText);
  
  console.log(`Detected ${sections.length} section(s) in file`);
  
  // Auto-detect type if not provided
  if (type === 'customers' && sections.length > 0) {
    const detectedType = detectImportType(sections);
    if (detectedType !== 'customers') {
      type = detectedType;
      console.log(`Auto-detected import type: ${type}`);
    }
  }

  // Step 3: Process each section
  const allImportRows: ImportRow[] = [];
  const quarantineData: Array<{
    rowIndex: number;
    originalData: Record<string, any>;
    cleanedData: AICleaningResult;
    reasons: string[];
  }> = [];

  let totalQuarantined = 0;
  let totalAICleaned = 0;
  let totalConfidence = 0;
  let confidenceCount = 0;

  for (const section of sections) {
    console.log(`Processing section: ${section.sectionName} (${section.rows.length} rows)`);

    // Step 4: Clean rows using AI or rule-based normalization
    const cleanedRows = useAI
      ? await cleanRowsBatch(section.rows, fieldMappings, {
          batchSize: 10,
          useAI: true,
          confidenceThreshold,
        })
      : section.rows.map((row, idx) => ({
          ...normalizeRowData(row, fieldMappings),
          fixedFields: [],
          aiSuggestions: [],
          rowIndex: idx,
        }));

    // Step 5: Determine which rows should be imported vs quarantined
    const importRows: ImportRow[] = [];
    const sectionQuarantine: typeof quarantineData = [];

    for (const cleaned of cleanedRows) {
      totalAICleaned++;
      totalConfidence += cleaned.confidence;
      confidenceCount++;

      const quarantine = shouldQuarantineRow(cleaned, ['fullName', 'phone']);

      if (quarantine.shouldQuarantine && quarantineEnabled) {
        // Quarantine this row
        sectionQuarantine.push({
          rowIndex: cleaned.rowIndex,
          originalData: cleaned.originalData,
          cleanedData: cleaned,
          reasons: quarantine.reasons,
        });
        totalQuarantined++;
      } else if (autoApprove || cleaned.confidence >= confidenceThreshold || !quarantineEnabled) {
        // Auto-approve for import
        importRows.push({
          rowIndex: cleaned.rowIndex,
          data: {
            ...cleaned.originalData,
            // Merge cleaned data into original
            phone: cleaned.phone || cleaned.originalData.phone,
            email: cleaned.email || cleaned.originalData.email,
            fullName: cleaned.fullName || cleaned.originalData.fullName,
            nrc: cleaned.nrc || cleaned.originalData.nrc,
            address: cleaned.address || cleaned.originalData.address,
            _cleaned: true,
            _confidence: cleaned.confidence,
            _warnings: cleaned.warnings,
          },
          status: 'ready',
          action: 'create',
          errors: cleaned.warnings,
        });
      } else {
        // Low confidence but not quarantined - add warnings
        importRows.push({
          rowIndex: cleaned.rowIndex,
          data: {
            ...cleaned.originalData,
            phone: cleaned.phone || cleaned.originalData.phone,
            email: cleaned.email || cleaned.originalData.email,
            fullName: cleaned.fullName || cleaned.originalData.fullName,
            nrc: cleaned.nrc || cleaned.originalData.nrc,
            address: cleaned.address || cleaned.originalData.address,
            _cleaned: true,
            _confidence: cleaned.confidence,
            _warnings: cleaned.warnings,
          },
          status: cleaned.confidence >= 0.6 ? 'ready' : 'needs_review',
          action: 'create',
          errors: cleaned.warnings,
        });
      }
    }

    allImportRows.push(...importRows);
    quarantineData.push(...sectionQuarantine);
  }

  // Step 6: Generate batch ID (use same ID for import and quarantine linking)
  const batchId = `import-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  // Step 7: Save quarantined rows
  let quarantinedIds: string[] = [];
  if (quarantineEnabled && quarantineData.length > 0) {
    quarantinedIds = await quarantineRowsBatch(agencyId, batchId, quarantineData);
    console.log(`Quarantined ${quarantinedIds.length} rows for review`);
  }

  // Step 8: Execute bulk import for approved rows (only if we have rows to import)
  let importResult: BulkImportResult;
  if (allImportRows.length > 0) {
    importResult = await executeBulkImport(
      agencyId,
      userId,
      allImportRows,
      type,
      file.name,
      file.size,
      false, // Not dry run
      batchId // Pass batchId to link with quarantine
    );
  } else {
    // No rows approved for import (all quarantined)
    importResult = {
      batchId: batchId,
      success: 0,
      failed: 0,
      skipped: 0,
      created: { customers: 0, loans: 0 },
      linked: { customers: 0, loans: 0 },
      errors: [],
      auditLog: {
        userId,
        timestamp: new Date(),
        fileSize: file.size,
        fileName: file.name,
      },
    };
  }

  // Step 8: Combine results
  const averageConfidence = confidenceCount > 0 ? totalConfidence / confidenceCount : 0;

  return {
    ...importResult,
    quarantined: totalQuarantined,
    quarantinedRowIds: quarantinedIds,
    sections: sections.map((s, sectionIdx) => {
      // Calculate row range for this section
      let rowStart = 0;
      for (let i = 0; i < sectionIdx; i++) {
        rowStart += sections[i].rows.length;
      }
      const rowEnd = rowStart + s.rows.length;
      
      // Count quarantined rows in this section's range
      const sectionQuarantined = quarantineData.filter(q => 
        q.rowIndex >= rowStart && q.rowIndex < rowEnd
      ).length;
      
      return {
        sectionName: s.sectionName,
        sectionType: s.sectionType,
        rowsProcessed: s.rows.length,
        rowsQuarantined: sectionQuarantined,
      };
    }),
    aiStats: {
      rowsCleaned: totalAICleaned,
      rowsNeedingReview: totalQuarantined,
      averageConfidence,
    },
  };
}
