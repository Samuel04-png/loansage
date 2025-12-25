/**
 * Bulk Import Wizard
 * Multi-step wizard for importing data with smart assistance
 */

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Upload, 
  FileText, 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Sparkles,
  Eye,
  Download,
  Play
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { Progress } from '../../../components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/ui/table';
import toast from 'react-hot-toast';
import { parseFile } from '../../../lib/data-import';
import { analyzeImport, ColumnMapping, MatchSuggestion, DataCleaningSuggestion } from '../../../lib/ai/bulk-import-assistant';
import { executeBulkImport, ImportRow } from '../../../lib/data-import/bulk-import-service';
import { useAuth } from '../../../hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../../lib/firebase/config';

interface BulkImportWizardProps {
  onComplete?: () => void;
}

type ImportStep = 'upload' | 'analyze' | 'review' | 'import' | 'complete';

export function BulkImportWizard({ onComplete }: BulkImportWizardProps) {
  const { profile, user } = useAuth();
  const [currentStep, setCurrentStep] = useState<ImportStep>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<{ headers: string[]; rows: any[] } | null>(null);
  const [analysis, setAnalysis] = useState<any>(null);
  const [columnMappings, setColumnMappings] = useState<ColumnMapping[]>([]);
  const [matchSuggestions, setMatchSuggestions] = useState<MatchSuggestion[]>([]);
  const [importRows, setImportRows] = useState<ImportRow[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const [dryRun, setDryRun] = useState(false); // Default to false so imports actually save
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch existing data for matching
  const { data: existingCustomers } = useQuery({
    queryKey: ['existing-customers', profile?.agency_id],
    queryFn: async () => {
      if (!profile?.agency_id) return [];
      const customersRef = collection(db, 'agencies', profile.agency_id, 'customers');
      const snapshot = await getDocs(customersRef);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    },
    enabled: !!profile?.agency_id && currentStep === 'analyze',
  });

  const { data: existingLoans } = useQuery({
    queryKey: ['existing-loans', profile?.agency_id],
    queryFn: async () => {
      if (!profile?.agency_id) return [];
      const loansRef = collection(db, 'agencies', profile.agency_id, 'loans');
      const snapshot = await getDocs(loansRef);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    },
    enabled: !!profile?.agency_id && currentStep === 'analyze',
  });

  const handleFileSelect = async (selectedFile: File) => {
    if (!selectedFile) return;

    // Validate file size (10MB limit)
    const maxSize = 10 * 1024 * 1024;
    if (selectedFile.size > maxSize) {
      toast.error('File size exceeds 10MB limit');
      return;
    }

    // Validate file type
    const validTypes = ['.csv', '.xlsx', '.xls'];
    const fileExtension = selectedFile.name.toLowerCase().substring(selectedFile.name.lastIndexOf('.'));
    if (!validTypes.some(type => selectedFile.name.toLowerCase().endsWith(type))) {
      toast.error('Please upload a CSV or Excel file (.csv, .xlsx, .xls)');
      return;
    }

    setFile(selectedFile);
    setIsAnalyzing(true);

    try {
      // Parse file
      const data = await parseFile(selectedFile);
      setParsedData(data);

      // Move to analyze step
      setCurrentStep('analyze');
    } catch (error: any) {
      toast.error(error.message || 'Failed to parse file');
      setIsAnalyzing(false);
    }
  };

  const handleAnalyze = async () => {
    if (!parsedData || !profile?.agency_id) return;

    setIsAnalyzing(true);
    try {
      const analysisResult = await analyzeImport(
        parsedData.headers,
        parsedData.rows,
        existingCustomers || [],
        existingLoans || []
      );

      setAnalysis(analysisResult);
      setColumnMappings(analysisResult.columnMappings);
      setMatchSuggestions(analysisResult.matchSuggestions);

      // Prepare import rows
      const rows: ImportRow[] = parsedData.rows.map((row, idx) => {
        const mappedData: any = {};
        
        // Valid system fields only - filter out invalid mappings
        const validCustomerFields = ['fullName', 'phone', 'email', 'nrc', 'address', 'employmentStatus', 'monthlyIncome', 'employer', 'jobTitle'];
        const validLoanFields = ['customerId', 'customerName', 'amount', 'interestRate', 'durationMonths', 'loanType', 'disbursementDate', 'collateralIncluded'];
        const allValidFields = [...validCustomerFields, ...validLoanFields];
        
        // First, apply column mappings (only for valid system fields)
        analysisResult.columnMappings
          .filter(mapping => allValidFields.includes(mapping.systemField))
          .forEach(mapping => {
            mappedData[mapping.systemField] = row[mapping.fileColumn];
          });

        // Helper to extract value from original row if not in mapped data
        const extractValue = (mappedKey: string, possibleKeys: string[]): any => {
          if (mappedData[mappedKey]) return mappedData[mappedKey];
          for (const key of possibleKeys) {
            if (row[key] !== undefined && row[key] !== null && String(row[key]).trim().length > 0) {
              return row[key];
            }
          }
          return undefined;
        };

        // Fill in missing fields from original row using common column name variations
        if (!mappedData.fullName) mappedData.fullName = extractValue('fullName', ['Full Name', 'fullName', 'Name', 'name', 'Customer Name', 'Customer Name']);
        if (!mappedData.phone) mappedData.phone = extractValue('phone', ['Phone', 'phone', 'Phone Number', 'Mobile', 'mobile', 'MSISDN', 'Tel']);
        if (!mappedData.email) mappedData.email = extractValue('email', ['Email', 'email', 'Email Address']);
        if (!mappedData.nrc) mappedData.nrc = extractValue('nrc', ['NRC/ID', 'NRC', 'nrc', 'ID Number', 'ID', 'id', 'National ID', 'National ID Number']);
        if (!mappedData.address) mappedData.address = extractValue('address', ['Address', 'address', 'Location', 'location']);
        if (!mappedData.amount) mappedData.amount = extractValue('amount', ['Amount', 'amount', 'Loan Amount', 'loanAmount', 'Principal', 'principal', 'Loan', 'loan']);
        if (!mappedData.interestRate) mappedData.interestRate = extractValue('interestRate', ['Interest Rate', 'interestRate', 'Rate', 'rate', 'Interest', 'interest']);
        if (!mappedData.durationMonths) mappedData.durationMonths = extractValue('durationMonths', ['Duration (Months)', 'durationMonths', 'Duration', 'duration', 'Months', 'months', 'Term', 'term']);
        if (!mappedData.loanType) mappedData.loanType = extractValue('loanType', ['Loan Type', 'loanType', 'Type', 'type', 'Loan Category']);
        if (!mappedData.employer) mappedData.employer = extractValue('employer', ['Employer', 'employer', 'Company', 'company', 'Workplace']);
        if (!mappedData.employmentStatus) mappedData.employmentStatus = extractValue('employmentStatus', ['Employment Status', 'employmentStatus', 'Job Status', 'Job Status']);
        if (!mappedData.monthlyIncome) mappedData.monthlyIncome = extractValue('monthlyIncome', ['Monthly Income', 'monthlyIncome', 'Income', 'income', 'Salary', 'salary']);
        if (!mappedData.jobTitle) mappedData.jobTitle = extractValue('jobTitle', ['Job Title', 'jobTitle', 'Title', 'title', 'Position', 'position']);

        // Also preserve original row data for fallback extraction
        mappedData._originalRow = row;

        const matchSuggestion = analysisResult.matchSuggestions.find(m => m.rowIndex === idx);
        const rowErrors = analysisResult.validationErrors.filter(e => e.rowIndex === idx);

        // Determine status - only mark as invalid if there are critical errors
        // Warnings shouldn't prevent import
        const criticalErrors = rowErrors.filter(e => e.severity === 'error');
        let status: 'ready' | 'needs_review' | 'invalid' = 'ready';
        if (criticalErrors.length > 0) {
          // Only mark as invalid if required fields are missing
          // If we have some data, allow import with warnings
          const hasSomeData = mappedData.fullName || mappedData.phone || mappedData.nrc || 
                            mappedData.amount || mappedData.durationMonths;
          if (!hasSomeData) {
            status = 'invalid';
          } else {
            status = 'needs_review'; // Has data but some errors - needs review but can proceed
          }
        } else if (matchSuggestion?.action === 'review') {
          status = 'needs_review';
        }

        // Determine action - default to 'create' unless explicitly set otherwise
        let action: 'create' | 'link' | 'skip' = 'create';
        if (matchSuggestion?.action === 'link') {
          action = 'link';
        } else if (matchSuggestion?.action === 'create_new') {
          action = 'create';
        } else if (criticalErrors.length > 0 && !(mappedData.fullName || mappedData.phone || mappedData.nrc || mappedData.amount)) {
          // Only skip if there are critical errors AND no usable data at all
          action = 'skip';
        } else {
          action = 'create';
        }

        return {
          rowIndex: idx,
          data: mappedData,
          status,
          errors: rowErrors.map(e => e.error),
          customerId: matchSuggestion?.suggestedMatch?.id,
          action,
        };
      });

      setImportRows(rows);
      setCurrentStep('review');
    } catch (error: any) {
      toast.error(error.message || 'Failed to analyze file');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleImport = async () => {
    if (!file || !profile?.agency_id || !user?.id || importRows.length === 0) {
      toast.error('Missing required information for import');
      return;
    }

    const rowsToImport = importRows.filter(r => r.action !== 'skip');
    
    console.log('Import rows analysis:', {
      totalRows: importRows.length,
      rowsToImport: rowsToImport.length,
      rowsByAction: {
        create: importRows.filter(r => r.action === 'create').length,
        link: importRows.filter(r => r.action === 'link').length,
        skip: importRows.filter(r => r.action === 'skip').length,
      },
      rowsByStatus: {
        ready: importRows.filter(r => r.status === 'ready').length,
        needs_review: importRows.filter(r => r.status === 'needs_review').length,
        invalid: importRows.filter(r => r.status === 'invalid').length,
      },
      sampleRows: rowsToImport.slice(0, 3).map(r => ({
        rowIndex: r.rowIndex,
        status: r.status,
        action: r.action,
        hasData: !!(r.data.fullName || r.data.phone || r.data.amount),
        errors: r.errors
      }))
    });

    if (rowsToImport.length === 0) {
      toast.error('No rows to import. All rows are set to skip. Check the data preview to see why rows were skipped.');
      return;
    }

    setIsImporting(true);
    try {
      const result = await executeBulkImport(
        profile.agency_id,
        user.id,
        rowsToImport,
        analysis.summary.detectedType,
        file.name,
        file.size,
        dryRun
      );

      console.log('Import completed with result:', result);

      setImportResult(result);
      setCurrentStep('complete');

      if (dryRun) {
        toast.success(
          `Dry run completed: ${result.success} records would be imported ` +
          `(${result.created.customers} customers, ${result.created.loans} loans). ` +
          `Uncheck "Dry run mode" to actually save the data.`,
          { duration: 6000 }
        );
      } else {
        if (result.success > 0) {
          const summary = `Successfully imported ${result.success} records ` +
            `(${result.created.customers} customers, ${result.created.loans} loans)`;
          toast.success(summary, { duration: 5000 });
        }
        
        if (result.failed > 0) {
          toast.error(
            `${result.failed} records failed. ${result.errors?.length || 0} errors. ` +
            `Check the error list below for details.`,
            { duration: 8000 }
          );
        }
        
        if (result.success === 0 && result.failed === 0) {
          toast.warning(
            'No records were imported. Check if rows have valid data and are not set to skip.',
            { duration: 6000 }
          );
        }
        
        if (onComplete && result.success > 0) onComplete();
      }
    } catch (error: any) {
      console.error('Import error:', error);
      toast.error(error.message || 'Failed to import data. Check console for details.');
    } finally {
      setIsImporting(false);
    }
  };

  const updateColumnMapping = (fileColumn: string, systemField: string) => {
    setColumnMappings(prev => 
      prev.map(m => 
        m.fileColumn === fileColumn 
          ? { ...m, systemField, confidence: 0.8 }
          : m
      )
    );
  };

  const updateRowAction = (rowIndex: number, action: 'create' | 'link' | 'skip') => {
    setImportRows(prev =>
      prev.map(r =>
        r.rowIndex === rowIndex ? { ...r, action } : r
      )
    );
  };

  const updateRowCustomerId = (rowIndex: number, customerId: string) => {
    setImportRows(prev =>
      prev.map(r =>
        r.rowIndex === rowIndex ? { ...r, customerId, action: 'link' } : r
      )
    );
  };

  useEffect(() => {
    if (currentStep === 'analyze' && parsedData && existingCustomers && existingLoans) {
      handleAnalyze();
    }
  }, [currentStep, parsedData, existingCustomers, existingLoans]);

  return (
    <div className="space-y-6">
      {/* Progress Steps */}
      <div className="flex items-center justify-between mb-8">
        {(['upload', 'analyze', 'review', 'import', 'complete'] as ImportStep[]).map((step, idx) => (
          <div key={step} className="flex items-center flex-1">
            <div className="flex flex-col items-center">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-all ${
                  getStepIndex(currentStep) >= idx
                    ? 'bg-gradient-to-r from-[#006BFF] to-[#4F46E5] text-white'
                    : 'bg-neutral-200 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-600'
                }`}
              >
                {getStepIndex(currentStep) > idx ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : (
                  idx + 1
                )}
              </div>
              <span className={`text-xs mt-2 font-medium ${
                getStepIndex(currentStep) >= idx
                  ? 'text-neutral-900 dark:text-neutral-100'
                  : 'text-neutral-500 dark:text-neutral-600'
              }`}>
                {step.charAt(0).toUpperCase() + step.slice(1)}
              </span>
            </div>
            {idx < 4 && (
              <div className={`flex-1 h-0.5 mx-2 ${
                getStepIndex(currentStep) > idx
                  ? 'bg-gradient-to-r from-[#006BFF] to-[#4F46E5]'
                  : 'bg-neutral-200 dark:bg-neutral-800'
              }`} />
            )}
          </div>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {/* Step 1: Upload */}
        {currentStep === 'upload' && (
          <motion.div
            key="upload"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <Card className="border-2 border-dashed border-neutral-300 dark:border-neutral-700">
              <CardContent className="pt-12 pb-12">
                <div className="flex flex-col items-center justify-center space-y-4">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#006BFF] to-[#4F46E5] flex items-center justify-center">
                    <Upload className="w-8 h-8 text-white" />
                  </div>
                  <div className="text-center">
                    <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-2">
                      Upload Your Data File
                    </h3>
                    <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
                      Supported formats: CSV, Excel (.xlsx, .xls)
                      <br />
                      Maximum file size: 10MB
                    </p>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    className="hidden"
                    onChange={(e) => {
                      const selectedFile = e.target.files?.[0];
                      if (selectedFile) handleFileSelect(selectedFile);
                    }}
                  />
                  <Button
                    onClick={() => fileInputRef.current?.click()}
                    className="bg-gradient-to-r from-[#006BFF] to-[#4F46E5] text-white"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Choose File
                  </Button>
                  {file && (
                    <div className="mt-4 p-4 bg-neutral-50 dark:bg-neutral-900 rounded-lg">
                      <div className="flex items-center gap-2">
                        <FileText className="w-5 h-5 text-neutral-600 dark:text-neutral-400" />
                        <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                          {file.name}
                        </span>
                        <Badge variant="outline" className="ml-2">
                          {(file.size / 1024).toFixed(2)} KB
                        </Badge>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Step 2: Analyze */}
        {currentStep === 'analyze' && (
          <motion.div
            key="analyze"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-[#006BFF]" />
                  Analysis in Progress
                </CardTitle>
                <CardDescription>
                  Analyzing file structure, suggesting column mappings, and identifying matches
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isAnalyzing ? (
                  <div className="flex flex-col items-center justify-center py-12 space-y-4">
                    <Loader2 className="w-12 h-12 animate-spin text-[#006BFF]" />
                    <p className="text-sm text-neutral-600 dark:text-neutral-400">
                      Analyzing your data...
                    </p>
                    <Progress value={50} className="w-full max-w-md" />
                  </div>
                ) : (
                  <div className="space-y-4">
                    {parsedData && (
                      <div className="p-4 bg-neutral-50 dark:bg-neutral-900 rounded-lg">
                        <p className="text-sm text-neutral-600 dark:text-neutral-400">
                          <strong>{parsedData.rows.length}</strong> rows detected
                          <br />
                          <strong>{parsedData.headers.length}</strong> columns found
                        </p>
                      </div>
                    )}
                    <Button
                      onClick={handleAnalyze}
                      className="w-full bg-gradient-to-r from-[#006BFF] to-[#4F46E5] text-white"
                    >
                      <Sparkles className="w-4 h-4 mr-2" />
                      Start Analysis
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Step 3: Review */}
        {currentStep === 'review' && analysis && (
          <motion.div
            key="review"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <ImportReviewStep
              analysis={analysis}
              parsedData={parsedData!}
              columnMappings={columnMappings}
              matchSuggestions={matchSuggestions}
              importRows={importRows}
              existingCustomers={existingCustomers || []}
              onUpdateColumnMapping={updateColumnMapping}
              onUpdateRowAction={updateRowAction}
              onUpdateRowCustomerId={updateRowCustomerId}
              onNext={() => setCurrentStep('import')}
              onBack={() => setCurrentStep('analyze')}
            />
          </motion.div>
        )}

        {/* Step 4: Import */}
        {currentStep === 'import' && (
          <motion.div
            key="import"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <Card>
              <CardHeader>
                <CardTitle>Ready to Import</CardTitle>
                <CardDescription>
                  Review import settings and execute the import
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
                    <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                      {importRows.filter(r => r.status === 'ready' && r.action !== 'skip').length}
                    </div>
                    <div className="text-sm text-neutral-600 dark:text-neutral-400">Ready</div>
                  </div>
                  <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                    <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                      {importRows.filter(r => r.status === 'needs_review').length}
                    </div>
                    <div className="text-sm text-neutral-600 dark:text-neutral-400">Needs Review</div>
                  </div>
                  <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                    <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                      {importRows.filter(r => r.status === 'invalid').length}
                    </div>
                    <div className="text-sm text-neutral-600 dark:text-neutral-400">Invalid</div>
                  </div>
                </div>

                <div className={`flex items-center gap-2 p-4 rounded-lg ${dryRun ? 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800' : 'bg-blue-50 dark:bg-blue-900/20'}`}>
                  <input
                    type="checkbox"
                    id="dryRun"
                    checked={dryRun}
                    onChange={(e) => setDryRun(e.target.checked)}
                    className="w-4 h-4"
                  />
                  <label htmlFor="dryRun" className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                    {dryRun ? (
                      <span className="text-amber-700 dark:text-amber-400">
                        ⚠️ Dry run mode enabled - No data will be saved (simulation only)
                      </span>
                    ) : (
                      <span className="text-blue-700 dark:text-blue-400">
                        ✓ Live import mode - Data will be saved to the system
                      </span>
                    )}
                  </label>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setCurrentStep('review')}
                    disabled={isImporting}
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back
                  </Button>
                  <Button
                    onClick={handleImport}
                    disabled={isImporting}
                    className="flex-1 bg-gradient-to-r from-[#006BFF] to-[#4F46E5] text-white"
                  >
                    {isImporting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Importing...
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4 mr-2" />
                        {dryRun ? 'Run Dry Import' : 'Execute Import'}
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Step 5: Complete */}
        {currentStep === 'complete' && importResult && (
          <motion.div
            key="complete"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  Import {dryRun ? 'Dry Run' : 'Completed'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
                    <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                      {importResult.success}
                    </div>
                    <div className="text-sm text-neutral-600 dark:text-neutral-400">Success</div>
                  </div>
                  <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                    <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                      {importResult.failed}
                    </div>
                    <div className="text-sm text-neutral-600 dark:text-neutral-400">Failed</div>
                  </div>
                </div>

                {importResult.errors && importResult.errors.length > 0 && (
                  <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                    <h4 className="font-semibold mb-2 text-red-800 dark:text-red-400">
                      Errors ({importResult.errors.length}):
                    </h4>
                    <div className="max-h-64 overflow-y-auto space-y-2">
                      {importResult.errors.slice(0, 20).map((error: any, idx: number) => (
                        <div key={idx} className="text-sm text-red-700 dark:text-red-300 p-2 bg-white dark:bg-neutral-800 rounded">
                          <span className="font-medium">Row {error.rowIndex + 1}:</span> {error.error}
                        </div>
                      ))}
                      {importResult.errors.length > 20 && (
                        <div className="text-sm text-red-600 dark:text-red-400 italic">
                          ... and {importResult.errors.length - 20} more errors
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setCurrentStep('upload');
                      setFile(null);
                      setParsedData(null);
                      setAnalysis(null);
                      setImportResult(null);
                    }}
                  >
                    Import Another File
                  </Button>
                  {!dryRun && (
                    <Button
                      onClick={onComplete}
                      className="flex-1 bg-gradient-to-r from-[#006BFF] to-[#4F46E5] text-white"
                    >
                      Done
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function getStepIndex(step: ImportStep): number {
  const steps: ImportStep[] = ['upload', 'analyze', 'review', 'import', 'complete'];
  return steps.indexOf(step);
}

// Import Review Step Component
function ImportReviewStep({
  analysis,
  parsedData,
  columnMappings,
  matchSuggestions,
  importRows,
  existingCustomers,
  onUpdateColumnMapping,
  onUpdateRowAction,
  onUpdateRowCustomerId,
  onNext,
  onBack,
}: any) {
  const [activeTab, setActiveTab] = useState('mappings');

  return (
    <Card>
      <CardHeader>
        <CardTitle>Review & Configure Import</CardTitle>
        <CardDescription>
          Review suggestions and configure your import settings
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="mappings">Column Mappings</TabsTrigger>
            <TabsTrigger value="preview">Data Preview</TabsTrigger>
            <TabsTrigger value="matches">Matches</TabsTrigger>
          </TabsList>

          <TabsContent value="mappings" className="space-y-4">
            <div className="space-y-2">
              {columnMappings.map((mapping: ColumnMapping) => (
                <div key={mapping.fileColumn} className="flex items-center gap-4 p-3 bg-neutral-50 dark:bg-neutral-900 rounded-lg">
                  <div className="flex-1">
                    <div className="font-medium text-neutral-900 dark:text-neutral-100">
                      {mapping.fileColumn}
                    </div>
                    <div className="text-sm text-neutral-600 dark:text-neutral-400">
                      {mapping.explanation}
                    </div>
                  </div>
                  <Badge className={mapping.confidence > 0.8 ? 'bg-emerald-500' : 'bg-amber-500'}>
                    {(mapping.confidence * 100).toFixed(0)}%
                  </Badge>
                  <span className="text-neutral-400">→</span>
                  <select
                    value={mapping.systemField}
                    onChange={(e) => onUpdateColumnMapping(mapping.fileColumn, e.target.value)}
                    className="px-3 py-1 border rounded-md"
                  >
                    <option value="">Unmapped</option>
                    <optgroup label="Customer">
                      <option value="fullName">Full Name</option>
                      <option value="phone">Phone</option>
                      <option value="email">Email</option>
                      <option value="nrc">NRC/ID</option>
                      <option value="address">Address</option>
                    </optgroup>
                    <optgroup label="Loan">
                      <option value="amount">Amount</option>
                      <option value="interestRate">Interest Rate</option>
                      <option value="durationMonths">Duration (Months)</option>
                      <option value="loanType">Loan Type</option>
                    </optgroup>
                  </select>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="preview" className="space-y-4">
            <div className="max-h-96 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Row</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Preview</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {importRows.slice(0, 20).map((row: ImportRow) => (
                    <TableRow key={row.rowIndex}>
                      <TableCell>{row.rowIndex + 1}</TableCell>
                      <TableCell>
                        <Badge
                          className={
                            row.status === 'ready'
                              ? 'bg-emerald-500'
                              : row.status === 'needs_review'
                              ? 'bg-amber-500'
                              : 'bg-red-500'
                          }
                        >
                          {row.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <select
                          value={row.action}
                          onChange={(e) => onUpdateRowAction(row.rowIndex, e.target.value as any)}
                          className="px-2 py-1 text-xs border rounded"
                        >
                          <option value="create">Create</option>
                          <option value="link">Link</option>
                          <option value="skip">Skip</option>
                        </select>
                      </TableCell>
                      <TableCell className="text-xs">
                        {JSON.stringify(row.data).substring(0, 50)}...
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="matches" className="space-y-4">
            <div className="space-y-2">
              {matchSuggestions.slice(0, 10).map((match: MatchSuggestion) => (
                <div key={match.rowIndex} className="p-3 bg-neutral-50 dark:bg-neutral-900 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">Row {match.rowIndex + 1}</div>
                      {match.suggestedMatch && (
                        <div className="text-sm text-neutral-600 dark:text-neutral-400">
                          Match: {match.suggestedMatch.name} ({match.suggestedMatch.confidence * 100}%)
                          <br />
                          <span className="text-xs">{match.suggestedMatch.reason}</span>
                        </div>
                      )}
                    </div>
                    <Badge>{match.action}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex gap-2 mt-6">
          <Button variant="outline" onClick={onBack}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <Button
            onClick={onNext}
            className="flex-1 bg-gradient-to-r from-[#006BFF] to-[#4F46E5] text-white"
          >
            Continue
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

