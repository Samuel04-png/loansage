/**
 * Quarantine Review Dialog
 * UI component for reviewing and fixing quarantined import rows
 */

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../../../components/ui/dialog';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Badge } from '../../../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/ui/table';
import { Textarea } from '../../../components/ui/textarea';
import { getQuarantinedRows, updateQuarantinedRow, bulkApproveQuarantined } from '../../../lib/data-import/quarantine-system';
import { importApprovedQuarantineRows } from '../../../lib/data-import/quarantine-import';
import { useAuth } from '../../../hooks/useAuth';
import { CheckCircle2, XCircle, Edit, Save, AlertCircle, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { QuarantinedRow } from '../../../lib/data-import/quarantine-system';

interface QuarantineReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  importBatchId: string;
  onRowsApproved?: (approvedCount: number) => void;
}

export function QuarantineReviewDialog({
  open,
  onOpenChange,
  importBatchId,
  onRowsApproved,
}: QuarantineReviewDialogProps) {
  const { profile, user } = useAuth();
  const queryClient = useQueryClient();
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [editedRows, setEditedRows] = useState<Record<string, Partial<QuarantinedRow>>>({});
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());

  // Fetch quarantined rows
  const { data: quarantinedRows = [], isLoading, refetch } = useQuery({
    queryKey: ['quarantined-rows', profile?.agency_id, importBatchId],
    queryFn: async () => {
      if (!profile?.agency_id) return [];
      return await getQuarantinedRows(profile.agency_id, importBatchId);
    },
    enabled: open && !!profile?.agency_id && !!importBatchId,
  });

  // Update row mutation
  const updateRowMutation = useMutation({
    mutationFn: async ({ rowId, updates }: { rowId: string; updates: Partial<QuarantinedRow> }) => {
      if (!profile?.agency_id) throw new Error('Agency ID not found');
      await updateQuarantinedRow(profile.agency_id, rowId, {
        status: updates.status || 'pending',
        fixedBy: user?.id,
        notes: updates.notes,
        cleanedData: updates.cleanedData as any,
      });
    },
    onSuccess: () => {
      toast.success('Row updated successfully');
      refetch();
      setEditingRowId(null);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update row');
    },
  });

  // Bulk approve and import mutation
  const bulkApproveMutation = useMutation({
    mutationFn: async (rowIds: string[]) => {
      if (!profile?.agency_id || !user?.id) throw new Error('Agency ID or user ID not found');
      
      // First, mark as approved
      await bulkApproveQuarantined(profile.agency_id, rowIds, user.id);
      
      // Then, import the approved rows
      // Detect type from first row (or default to customers)
      const firstRow = quarantinedRows.find(r => rowIds.includes(r.id));
      const type = firstRow?.cleanedData ? 'customers' : 'customers'; // TODO: Better type detection
      
      const importResult = await importApprovedQuarantineRows(
        profile.agency_id,
        user.id,
        rowIds,
        type
      );
      
      if (importResult.failed > 0) {
        throw new Error(`Failed to import ${importResult.failed} row(s)`);
      }
      
      return { approved: rowIds.length, imported: importResult.success };
    },
    onSuccess: (result) => {
      toast.success(`Approved and imported ${result.imported} row(s)`);
      refetch();
      setSelectedRows(new Set());
      onRowsApproved?.(result.approved);
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['loans'] });
      queryClient.invalidateQueries({ queryKey: ['quarantined-rows'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to approve and import rows');
    },
  });

  const handleEditRow = (rowId: string) => {
    setEditingRowId(rowId);
    const row = quarantinedRows.find(r => r.id === rowId);
    if (row) {
      setEditedRows({
        ...editedRows,
        [rowId]: {
          cleanedData: { ...row.cleanedData },
          notes: row.notes,
        },
      });
    }
  };

  const handleSaveRow = (rowId: string) => {
    const edited = editedRows[rowId];
    if (!edited) return;

    updateRowMutation.mutate({
      rowId,
      updates: {
        status: 'fixed',
        ...edited,
      },
    });
  };

  const handleBulkApprove = () => {
    if (selectedRows.size === 0) {
      toast.error('Please select rows to approve');
      return;
    }
    bulkApproveMutation.mutate(Array.from(selectedRows));
  };

  const toggleRowSelection = (rowId: string) => {
    const newSelected = new Set(selectedRows);
    if (newSelected.has(rowId)) {
      newSelected.delete(rowId);
    } else {
      newSelected.add(rowId);
    }
    setSelectedRows(newSelected);
  };

  if (isLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Review Quarantined Data</DialogTitle>
            <DialogDescription>Loading quarantined rows...</DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-[#006BFF]" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-amber-500" />
            Review Quarantined Data
          </DialogTitle>
          <DialogDescription>
            {quarantinedRows.length} row(s) need manual review before import. Fix missing fields or approve after review.
          </DialogDescription>
        </DialogHeader>

        {quarantinedRows.length === 0 ? (
          <div className="py-12 text-center text-neutral-500">
            <CheckCircle2 className="w-12 h-12 mx-auto mb-4 text-green-500" />
            <p>No rows in quarantine. All data was successfully imported!</p>
          </div>
        ) : (
          <>
            {/* Bulk Actions */}
            {selectedRows.size > 0 && (
              <div className="flex items-center justify-between p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                  {selectedRows.size} row(s) selected
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedRows(new Set())}
                  >
                    Clear Selection
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleBulkApprove}
                    disabled={bulkApproveMutation.isPending}
                  >
                    {bulkApproveMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Approving...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                        Approve Selected ({selectedRows.size})
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}

            {/* Quarantined Rows Table */}
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <input
                        type="checkbox"
                        checked={selectedRows.size === quarantinedRows.length && quarantinedRows.length > 0}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedRows(new Set(quarantinedRows.map(r => r.id)));
                          } else {
                            setSelectedRows(new Set());
                          }
                        }}
                      />
                    </TableHead>
                    <TableHead>Row #</TableHead>
                    <TableHead>Issues</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>NRC</TableHead>
                    <TableHead>Confidence</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {quarantinedRows.map((row) => {
                    const isEditing = editingRowId === row.id;
                    const edited = editedRows[row.id];
                    const cleaned = edited?.cleanedData || row.cleanedData;

                    return (
                      <TableRow key={row.id}>
                        <TableCell>
                          <input
                            type="checkbox"
                            checked={selectedRows.has(row.id)}
                            onChange={() => toggleRowSelection(row.id)}
                          />
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {row.rowIndex + 1}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            {row.quarantineReasons.map((reason, idx) => (
                              <Badge key={idx} variant="warning" className="text-xs">
                                {reason}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          {isEditing ? (
                            <Input
                              value={cleaned.fullName || ''}
                              onChange={(e) => setEditedRows({
                                ...editedRows,
                                [row.id]: {
                                  ...edited,
                                  cleanedData: { ...cleaned, fullName: e.target.value },
                                },
                              })}
                              placeholder="Full Name"
                            />
                          ) : (
                            cleaned.fullName || <span className="text-neutral-400">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {isEditing ? (
                            <Input
                              value={cleaned.phone || ''}
                              onChange={(e) => setEditedRows({
                                ...editedRows,
                                [row.id]: {
                                  ...edited,
                                  cleanedData: { ...cleaned, phone: e.target.value },
                                },
                              })}
                              placeholder="+260XXXXXXXXX"
                            />
                          ) : (
                            cleaned.phone || <span className="text-neutral-400">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {isEditing ? (
                            <Input
                              value={cleaned.email || ''}
                              onChange={(e) => setEditedRows({
                                ...editedRows,
                                [row.id]: {
                                  ...edited,
                                  cleanedData: { ...cleaned, email: e.target.value },
                                },
                              })}
                              placeholder="email@example.com"
                            />
                          ) : (
                            cleaned.email || <span className="text-neutral-400">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {isEditing ? (
                            <Input
                              value={cleaned.nrc || ''}
                              onChange={(e) => setEditedRows({
                                ...editedRows,
                                [row.id]: {
                                  ...edited,
                                  cleanedData: { ...cleaned, nrc: e.target.value },
                                },
                              })}
                              placeholder="NRC Number"
                            />
                          ) : (
                            cleaned.nrc || <span className="text-neutral-400">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={cleaned.confidence >= 0.7 ? 'success' : cleaned.confidence >= 0.5 ? 'warning' : 'destructive'}
                          >
                            {(cleaned.confidence * 100).toFixed(0)}%
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            {isEditing ? (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setEditingRowId(null);
                                    setEditedRows({ ...editedRows, [row.id]: undefined });
                                  }}
                                >
                                  Cancel
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={() => handleSaveRow(row.id)}
                                  disabled={updateRowMutation.isPending}
                                >
                                  <Save className="w-4 h-4 mr-1" />
                                  Save
                                </Button>
                              </>
                            ) : (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleEditRow(row.id)}
                                >
                                  <Edit className="w-4 h-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={() => {
                                    bulkApproveMutation.mutate([row.id]);
                                  }}
                                  disabled={bulkApproveMutation.isPending}
                                >
                                  <CheckCircle2 className="w-4 h-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Warnings Summary */}
            {quarantinedRows.length > 0 && (
              <div className="mt-4 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                <h4 className="font-semibold text-amber-900 dark:text-amber-100 mb-2">
                  Common Issues Found:
                </h4>
                <ul className="text-sm text-amber-800 dark:text-amber-200 list-disc list-inside space-y-1">
                  {Array.from(new Set(quarantinedRows.flatMap(r => r.quarantineReasons))).map((reason, idx) => (
                    <li key={idx}>{reason}</li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {quarantinedRows.length > 0 && (
            <Button
              onClick={() => {
                bulkApproveMutation.mutate(quarantinedRows.map(r => r.id));
              }}
              disabled={bulkApproveMutation.isPending}
            >
              {bulkApproveMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Approving All...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Approve All ({quarantinedRows.length})
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
