/**
 * AI Chat Panel - Resizable side panel for AI conversations
 * Cursor/VSCode style integration
 */

import { useState, useEffect, useRef } from 'react';
import { X, Send, Sparkles, Loader2, Info, Copy, Check, User, Bot, Clock, Trash2, Download, RefreshCw, Zap, TrendingUp, AlertCircle, FileText, Users, DollarSign, BarChart3, ChevronDown, CheckCircle2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '../ui/avatar';
import { cn } from '../../lib/utils';
import { askLoanOfficerAssistant, getCommonQueries } from '../../lib/ai/loan-officer-assistant';
import { useAuth } from '../../hooks/useAuth';
import { useAgency } from '../../hooks/useAgency';
import { useNavigate } from 'react-router-dom';
import type { AssistantResponse } from '../../lib/ai/loan-officer-assistant';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { createLoanTransaction } from '../../lib/firebase/loan-transactions';
import { doc, updateDoc, serverTimestamp, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase/config';
import { createAuditLog } from '../../lib/firebase/firestore-helpers';
import { useQueryClient } from '@tanstack/react-query';

interface AIChatPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  position?: 'right' | 'left';
  defaultWidth?: number;
  onWidthChange?: (width: number) => void;
}

type AIMode = 'ask' | 'action' | 'auto';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  data?: any;
  suggestions?: string[];
  actions?: Array<{ label: string; type: string; data: any }>;
  pendingAction?: {
    type: string;
    data: any;
    description: string;
  };
}

export function AIChatPanel({
  open,
  onOpenChange,
  position = 'right',
  defaultWidth = 375,
  onWidthChange,
}: AIChatPanelProps) {
  const { profile, user } = useAuth();
  const { agency } = useAgency();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  // Persist panel width in localStorage
  const [width, setWidth] = useState(() => {
    const saved = localStorage.getItem('ai-chat-panel-width');
    return saved ? parseInt(saved, 10) : defaultWidth;
  });
  
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [mode, setMode] = useState<AIMode>('ask');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  // Mode always defaults to 'ask' - no localStorage persistence

  // Save width to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('ai-chat-panel-width', width.toString());
  }, [width]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollContainerRef.current && messages.length > 0) {
      const scrollContainer = scrollContainerRef.current;
      // Use smooth scroll to bottom
      scrollContainer.scrollTo({
        top: scrollContainer.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [messages, isLoading]);

  // Focus input when panel opens
  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + L to toggle
      if ((e.metaKey || e.ctrlKey) && e.key === 'l') {
        e.preventDefault();
        onOpenChange(!open);
      }
      // Escape to close
      if (e.key === 'Escape' && open) {
        onOpenChange(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onOpenChange]);

  const handleSend = async (customMessage?: string) => {
    const messageToSend = customMessage || input.trim();
    if (!messageToSend || isLoading || !profile?.agency_id) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: messageToSend,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // Enhanced prompt based on mode
      let enhancedQuestion = messageToSend;
      if (mode === 'action' || mode === 'auto') {
        enhancedQuestion = `${messageToSend}\n\n[Mode: ${mode.toUpperCase()}] I want to perform actions. Please identify what actions need to be taken and provide them in a structured format.`;
      }

      const response = await askLoanOfficerAssistant({
        question: enhancedQuestion,
        context: {
          agencyId: profile.agency_id,
          userId: profile.id,
          mode: mode, // Pass mode to assistant
        },
      });

      // Extract actions from response if in action/auto mode
      let pendingAction = null;
      if ((mode === 'action' || mode === 'auto') && response.actions && response.actions.length > 0) {
        const primaryAction = response.actions[0];
        pendingAction = {
          type: primaryAction.type,
          data: primaryAction.data,
          description: primaryAction.label || 'Perform action',
        };
      }

      const aiMessage: ChatMessage = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        content: response.answer,
        timestamp: new Date(),
        data: response.data,
        suggestions: response.suggestions,
        actions: response.actions,
        pendingAction: pendingAction || undefined,
      };

      setMessages((prev) => [...prev, aiMessage]);

      // Auto mode: Execute action immediately if pending
      if (mode === 'auto' && pendingAction) {
        setTimeout(() => {
          handleExecuteAction(pendingAction.type, pendingAction.data, aiMessage.id);
        }, 1000); // Small delay to show the message first
      }
    } catch (error: any) {
      console.error('AI Assistant error:', error);
      
      // Extract user-friendly error message
      let errorContent = 'I apologize, but I encountered an error while processing your request.';
      let errorTitle = 'AI Service Error';
      
      const errorMessage = error?.message || error?.toString() || 'Unknown error';
      
      // Handle specific error cases
      if (errorMessage.includes('Service is too busy') || errorMessage.includes('too busy')) {
        errorContent = `**AI Service Temporarily Unavailable**

The AI service is currently experiencing high traffic and is temporarily unavailable. 

**What you can do:**
- Please try again in a few moments
- The service should be back to normal shortly
- Your request has been saved and you can retry when ready

We apologize for the inconvenience.`;
        errorTitle = 'Service Busy';
      } else if (errorMessage.includes('CORS') || errorMessage.includes('network') || errorMessage.includes('Failed to fetch')) {
        errorContent = `**Network Connection Error**

I'm having trouble connecting to the AI service. This could be due to:
- Network connectivity issues
- Service temporarily unavailable
- CORS configuration problems

**What you can do:**
- Check your internet connection
- Try refreshing the page
- Wait a moment and try again`;
        errorTitle = 'Connection Error';
      } else if (errorMessage.includes('rate limit') || errorMessage.includes('quota')) {
        errorContent = `**Rate Limit Exceeded**

The AI service has reached its rate limit. 

**What you can do:**
- Please wait a few minutes before trying again
- Try reducing the frequency of your requests`;
        errorTitle = 'Rate Limit';
      } else if (errorMessage.includes('unauthenticated') || errorMessage.includes('logged in')) {
        errorContent = `**Authentication Required**

You need to be logged in to use the AI assistant.

**What you can do:**
- Please log in and try again
- Refresh the page if you're already logged in`;
        errorTitle = 'Authentication Required';
      } else {
        errorContent = `**Error: ${errorTitle}**

${errorMessage}

**What you can do:**
- Try rephrasing your question
- Wait a moment and try again
- If the problem persists, please contact support`;
      }
      
      const errorMessageObj: ChatMessage = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: errorContent,
        timestamp: new Date(),
      };
      
      setMessages((prev) => [...prev, errorMessageObj]);
      
      // Show appropriate toast based on error type
      if (errorMessage.includes('Service is too busy') || errorMessage.includes('too busy')) {
        toast.error('AI service is temporarily busy. Please try again in a moment.', { duration: 5000 });
      } else if (errorMessage.includes('CORS') || errorMessage.includes('network')) {
        toast.error('Network error. Please check your connection and try again.', { duration: 5000 });
      } else {
        toast.error('Failed to get AI response. Please try again.', { duration: 4000 });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleExecuteAction = async (actionType: string, actionData: any, messageId?: string) => {
    if (!profile?.agency_id || !profile?.id || !user?.id) {
      toast.error('Missing user context');
      return;
    }

    try {
      switch (actionType) {
        case 'create_loan': {
          // Extract loan parameters from actionData
          const {
            customerId,
            customerName,
            amount,
            interestRate = 15,
            durationMonths = 12,
            loanType = 'Personal',
            disbursementDate,
          } = actionData;

          // If customerName is provided but not customerId, try to find customer
          let finalCustomerId = customerId;
          if (!finalCustomerId && customerName) {
            const customersRef = collection(db, 'agencies', profile.agency_id, 'customers');
            const customersQuery = query(
              customersRef,
              where('fullName', '==', customerName)
            );
            const customersSnapshot = await getDocs(customersQuery);
            
            if (!customersSnapshot.empty) {
              finalCustomerId = customersSnapshot.docs[0].id;
            } else {
              toast.error(`Customer "${customerName}" not found. Please create the customer first.`);
              return;
            }
          }

          if (!finalCustomerId) {
            toast.error('Customer ID or name is required to create a loan.');
            return;
          }

          if (!amount || amount <= 0) {
            toast.error('Valid loan amount is required.');
            return;
          }

          // Create loan using transaction
          const result = await createLoanTransaction({
            agencyId: profile.agency_id,
            customerId: finalCustomerId,
            officerId: user.id,
            amount: typeof amount === 'string' ? parseFloat(amount) : amount,
            interestRate: typeof interestRate === 'string' ? parseFloat(interestRate) : interestRate,
            durationMonths: typeof durationMonths === 'string' ? parseInt(durationMonths) : durationMonths,
            loanType: loanType || 'Personal',
            disbursementDate: disbursementDate ? new Date(disbursementDate) : new Date(),
            collateralIncluded: false,
          });

          if (result.success) {
            toast.success(`Loan created successfully! Loan ID: ${result.loanId}`);
            queryClient.invalidateQueries({ queryKey: ['loans'] });
            
            // Update message to show success
            if (messageId) {
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === messageId
                    ? {
                        ...msg,
                        pendingAction: undefined,
                        content: `${typeof msg.content === 'string' ? msg.content : String(msg.content || '')}\n\n✅ **Action Completed:** Loan created successfully (ID: ${result.loanId})`,
                      }
                    : msg
                )
              );
            }
          } else {
            throw new Error(result.error || 'Failed to create loan');
          }
          break;
        }

        case 'update_loan_status': {
          const { loanId, status, loanNumber } = actionData;

          // If loanNumber is provided but not loanId, try to find loan
          let finalLoanId = loanId;
          if (!finalLoanId && loanNumber) {
            const loansRef = collection(db, 'agencies', profile.agency_id, 'loans');
            const loansQuery = query(loansRef, where('loanNumber', '==', loanNumber));
            const loansSnapshot = await getDocs(loansQuery);
            
            if (!loansSnapshot.empty) {
              finalLoanId = loansSnapshot.docs[0].id;
            } else {
              toast.error(`Loan with number "${loanNumber}" not found.`);
              return;
            }
          }

          if (!finalLoanId) {
            toast.error('Loan ID or loan number is required.');
            return;
          }

          if (!status) {
            toast.error('New status is required.');
            return;
          }

          const validStatuses = ['pending', 'approved', 'active', 'completed', 'defaulted', 'rejected', 'cancelled'];
          if (!validStatuses.includes(status)) {
            toast.error(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
            return;
          }

          const loanRef = doc(db, 'agencies', profile.agency_id, 'loans', finalLoanId);
          
          // Get current status first
          const { getDoc } = await import('firebase/firestore');
          const loanSnap = await getDoc(loanRef);
          if (!loanSnap.exists()) {
            toast.error('Loan not found.');
            return;
          }

          const currentStatus = loanSnap.data().status;
          if (currentStatus === status) {
            toast.info('Loan status is already set to this value.');
            return;
          }

          await updateDoc(loanRef, {
            status: status,
            statusUpdatedAt: serverTimestamp(),
            statusUpdatedBy: user.id,
            updatedAt: serverTimestamp(),
          });

          // Create audit log
          await createAuditLog(profile.agency_id, {
            actorId: user.id,
            action: 'update_loan_status',
            targetCollection: 'loans',
            targetId: finalLoanId,
            metadata: {
              oldStatus: currentStatus,
              newStatus: status,
            },
          }).catch(() => {
            // Ignore audit log errors
          });

          toast.success(`Loan status updated to "${status}"`);
          queryClient.invalidateQueries({ queryKey: ['loans'] });
          queryClient.invalidateQueries({ queryKey: ['loan', finalLoanId] });

          // Update message to show success
          if (messageId) {
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === messageId
                  ? {
                      ...msg,
                      pendingAction: undefined,
                      content: `${typeof msg.content === 'string' ? msg.content : String(msg.content || '')}\n\n✅ **Action Completed:** Loan status updated from "${currentStatus}" to "${status}"`,
                    }
                  : msg
              )
            );
          }
          break;
        }

        default:
          // Fallback to navigation actions
          handleActionClick({ label: actionType, type: actionType, data: actionData });
      }
    } catch (error: any) {
      console.error('Action execution error:', error);
      toast.error(`Failed to execute action: ${error.message || 'Unknown error'}`);
      
      // Update message to show error
      if (messageId) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === messageId
              ? {
                  ...msg,
                  pendingAction: undefined,
                  content: `${typeof msg.content === 'string' ? msg.content : String(msg.content || '')}\n\n❌ **Action Failed:** ${error?.message || 'Unknown error'}`,
                }
              : msg
          )
        );
      }
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setInput(suggestion);
    inputRef.current?.focus();
    // Auto-send the suggestion
    setTimeout(() => handleSend(suggestion), 100);
  };

  const handleActionClick = (action: { label: string; type: string; data: any }) => {
    switch (action.type) {
      case 'view_loans':
        if (action.data?.status) {
          navigate(`/admin/loans?status=${action.data.status}`);
        } else {
          navigate('/admin/loans');
        }
        onOpenChange(false); // Close panel after navigation
        break;
      case 'view_loan':
        if (action.data?.loanId) {
          navigate(`/admin/loans/${action.data.loanId}`);
          onOpenChange(false);
        }
        break;
      case 'view_customers':
        navigate('/admin/customers');
        onOpenChange(false);
        break;
      case 'view_customer':
        if (action.data?.customerId) {
          navigate(`/admin/customers/${action.data.customerId}`);
          onOpenChange(false);
        }
        break;
      case 'view_dashboard':
        navigate('/admin/dashboard');
        onOpenChange(false);
        break;
      case 'view_reports':
        navigate('/admin/reports');
        onOpenChange(false);
        break;
      case 'add_payment':
        if (action.data?.loanId) {
          navigate(`/admin/loans/${action.data.loanId}?tab=repayments`);
          onOpenChange(false);
        }
        break;
      case 'update_status':
        if (action.data?.loanId) {
          navigate(`/admin/loans/${action.data.loanId}?tab=overview`);
          onOpenChange(false);
        }
        break;
      default:
        console.log('Action:', action);
        toast.info(`Action: ${action.label}`);
    }
  };

  const handleClearChat = () => {
    if (messages.length === 0) return;
    if (window.confirm('Clear all messages?')) {
      setMessages([]);
      toast.success('Chat cleared');
    }
  };

  const handleExportChat = () => {
    const chatText = messages.map(msg => {
      const role = msg.role === 'user' ? 'You' : 'AI';
      const time = formatTime(msg.timestamp);
      return `[${time}] ${role}: ${msg.content}`;
    }).join('\n\n');

    const blob = new Blob([chatText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tengaloans-ai-chat-${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Chat exported');
  };

  const formatTime = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(date);
  };

  // Notify parent of width changes
  useEffect(() => {
    if (open) {
      onWidthChange?.(width);
    } else {
      onWidthChange?.(0);
    }
  }, [open, width, onWidthChange]);

  useEffect(() => {
    if (!isResizing) return;

    const handleResize = (e: MouseEvent) => {
      if (!panelRef.current) return;
      
      // For right-side panel, calculate width from right edge
      const newWidth = position === 'right'
        ? window.innerWidth - e.clientX
        : e.clientX;

      const minWidth = 250;
      const maxWidth = 600;
      const clampedWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));
      setWidth(clampedWidth);
      onWidthChange?.(clampedWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener('mousemove', handleResize);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    
    return () => {
      document.removeEventListener('mousemove', handleResize);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing, position, onWidthChange]);

  const commonQueries = getCommonQueries();

  return (
    <div
      ref={panelRef}
      className={cn(
        'h-full bg-white dark:bg-[#1E293B] border-l border-neutral-200 dark:border-neutral-800 flex flex-col transition-all duration-300 ease-in-out overflow-hidden flex-shrink-0',
        open && 'shadow-[0_0_8px_rgba(0,0,0,0.08)] dark:shadow-[0_0_8px_rgba(0,0,0,0.3)]',
        !open && 'border-0 overflow-hidden'
      )}
      style={{ 
        width: open ? `${width}px` : '0px',
        minWidth: open ? `${width}px` : '0px',
        maxWidth: open ? `${width}px` : '0px',
        height: '100%', // Fixed height - matches parent (100vh)
        maxHeight: '100%', // Never exceed viewport
        opacity: open ? 1 : 0,
        pointerEvents: open ? 'auto' : 'none',
        overscrollBehavior: 'contain'
      }}
      onWheel={(e) => {
        // Stop scroll events from propagating to main content
        if (open) {
          e.stopPropagation();
        }
      }}
    >
      {/* Resize Handle - VS Code/Cursor style */}
      {open && (
        <div
          className={cn(
            'absolute top-0 bottom-0 w-1 cursor-col-resize hover:bg-[#006BFF] transition-colors z-10 group',
            position === 'right' ? 'left-0' : 'right-0'
          )}
          onMouseDown={(e) => {
            e.preventDefault();
            setIsResizing(true);
          }}
          title="Drag to resize"
        >
          <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-0.5 bg-transparent group-hover:bg-[#006BFF]/50 transition-colors" />
        </div>
      )}

      {open && (
        <>
          {/* Header - Enhanced VS Code/Cursor style */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-200 dark:border-neutral-800 flex-shrink-0 bg-gradient-to-r from-white to-neutral-50/50 dark:from-[#1E293B] dark:to-[#1E293B]/80 backdrop-blur-sm">
            <div className="flex items-center gap-2.5">
              <div className="relative">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#006BFF] to-[#4F46E5] flex items-center justify-center shadow-sm">
                  <Sparkles className="w-3.5 h-3.5 text-white" />
                </div>
                <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-green-500 rounded-full border-2 border-white dark:border-[#1E293B] animate-pulse" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">TengaLoans AI</h3>
                <p className="text-[10px] text-neutral-500 dark:text-neutral-400">Always here to help</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleExportChat}
                    className="h-7 w-7 p-0 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 rounded-lg transition-colors"
                    title="Export chat"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClearChat}
                    className="h-7 w-7 p-0 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-500 dark:text-neutral-400 hover:text-red-600 dark:hover:text-red-400 rounded-lg transition-colors"
                    title="Clear chat"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onOpenChange(false)}
                className="h-7 w-7 p-0 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 rounded-lg transition-colors"
                title="Close panel"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Messages - Scrollable area ONLY (like VS Code sidebar) */}
          <div 
            ref={scrollContainerRef}
            className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden"
            style={{ 
              scrollBehavior: 'smooth',
              overscrollBehavior: 'contain',
              maxHeight: '100%' // Never exceed container
            }}
            onWheel={(e) => {
              e.stopPropagation();
            }}
            onScroll={(e) => {
              e.stopPropagation();
            }}
          >
            <div className="px-4 py-4">
              <AnimatePresence>
                {messages.length === 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="py-8"
                  >
                    <div className="flex flex-col items-center text-center mb-6">
                      <div className="relative mb-4">
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#006BFF] to-[#4F46E5] flex items-center justify-center shadow-lg">
                          <Sparkles className="w-8 h-8 text-white" />
                        </div>
                        <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white dark:border-[#1E293B] animate-pulse" />
                      </div>
                      <h4 className="text-base font-semibold text-neutral-900 dark:text-neutral-100 mb-2">TengaLoans AI Assistant</h4>
                      <p className="text-sm text-neutral-600 dark:text-neutral-400 max-w-sm leading-relaxed">
                        Ask me anything about your loan portfolio. I can analyze loans, customers, payments, and provide insights on demand.
                      </p>
                    </div>
                    <div className="space-y-3">
                      <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 mb-3 uppercase tracking-wider">Try asking:</p>
                      {commonQueries.slice(0, 4).map((query, index) => (
                        <motion.button
                          key={index}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.1 }}
                          onClick={() => handleSuggestionClick(query)}
                          className="block w-full text-left text-xs text-[#006BFF] dark:text-blue-400 hover:text-[#0052CC] dark:hover:text-blue-300 hover:bg-[#006BFF]/10 dark:hover:bg-blue-500/20 px-4 py-2.5 rounded-lg border border-[#006BFF]/20 dark:border-blue-500/30 transition-all hover:shadow-sm active:scale-[0.98]"
                        >
                          {query}
                        </motion.button>
                      ))}
                    </div>
                    
                    {/* Quick Actions */}
                    <div className="mt-6 pt-6 border-t border-neutral-200 dark:border-neutral-800">
                      <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 mb-3 uppercase tracking-wider">Quick Actions</p>
                      <div className="grid grid-cols-2 gap-2">
                        <QuickActionButton
                          icon={BarChart3}
                          label="Portfolio"
                          onClick={() => handleSuggestionClick('What is my portfolio performance?')}
                        />
                        <QuickActionButton
                          icon={AlertCircle}
                          label="Overdue"
                          onClick={() => handleSuggestionClick('Show me all overdue loans')}
                        />
                        <QuickActionButton
                          icon={Users}
                          label="Customers"
                          onClick={() => handleSuggestionClick('Which customers have multiple loans?')}
                        />
                        <QuickActionButton
                          icon={DollarSign}
                          label="Revenue"
                          onClick={() => handleSuggestionClick('What is my total revenue this month?')}
                        />
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence>
                {messages.map((message, index) => (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2, delay: index * 0.05 }}
                  >
                    <ChatMessageComponent 
                      message={message} 
                      profile={profile}
                      onSuggestionClick={handleSuggestionClick}
                      onActionClick={handleActionClick}
                      onExecuteAction={handleExecuteAction}
                      mode={mode}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>

              {isLoading && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center gap-2 py-4 text-neutral-500 dark:text-neutral-400"
                >
                  <Loader2 className="w-4 h-4 animate-spin text-[#006BFF] dark:text-blue-400" />
                  <span className="text-sm">AI is thinking...</span>
                </motion.div>
              )}

              <div ref={messagesEndRef} className="h-1" />
            </div>
          </div>

          {/* Input - Clean Design with Mode Dropdown Below */}
          <div className="border-t border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#1E293B] flex-shrink-0">
            <div className="p-4 space-y-3">
              {/* Input Row */}
              <div className="flex items-center gap-2">
                <div className="flex-1 relative">
                  <Input
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                    placeholder={
                      mode === 'ask' ? 'Ask about loans, customers, portfolio...' :
                      mode === 'action' ? 'Tell me what to do (e.g., "Create loan for John Doe")...' :
                      'I\'ll automatically perform actions...'
                    }
                    className="pr-12 h-11 bg-white dark:bg-neutral-800/50 border-neutral-200 dark:border-neutral-700 focus:border-[#006BFF] dark:focus:border-blue-500 focus:ring-2 focus:ring-[#006BFF]/20 dark:focus:ring-blue-500/30 text-sm text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-500 dark:placeholder:text-neutral-400 rounded-lg"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-neutral-400 dark:text-neutral-500">
                    ⏎
                  </div>
                </div>
                <Button
                  onClick={handleSend}
                  disabled={!input.trim() || isLoading}
                  size="sm"
                  className="h-11 w-11 p-0 bg-green-500 hover:bg-green-600 text-white shadow-sm hover:shadow-md transition-all rounded-full disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </Button>
              </div>
              
              {/* Mode Dropdown Row - Positioned Below Input */}
              <div className="flex items-center justify-between">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-3 text-sm font-medium text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-md transition-colors"
                    >
                      <span className="capitalize font-semibold">{mode}</span>
                      <ChevronDown className="w-3.5 h-3.5 ml-2 text-neutral-500 dark:text-neutral-400" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent 
                    align="start" 
                    side="bottom"
                    sideOffset={8}
                    className="w-56 dark:bg-[#1E293B] dark:border-neutral-700 shadow-xl"
                  >
                    <div className="px-3 py-2 text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider border-b border-neutral-200 dark:border-neutral-700">
                      Agent Mode
                    </div>
                    <DropdownMenuItem
                      onClick={() => setMode('ask')}
                      className={cn(
                        "flex items-center justify-between cursor-pointer py-2.5 px-3 my-1 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800",
                        mode === 'ask' && "bg-[#006BFF]/10 dark:bg-blue-500/20"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <Bot className="w-4 h-4 text-neutral-600 dark:text-neutral-300" />
                        <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">Ask</span>
                      </div>
                      {mode === 'ask' && <CheckCircle2 className="w-4 h-4 text-[#006BFF] dark:text-blue-400" />}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setMode('action')}
                      className={cn(
                        "flex items-center justify-between cursor-pointer py-2.5 px-3 my-1 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800",
                        mode === 'action' && "bg-[#006BFF]/10 dark:bg-blue-500/20"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <Zap className="w-4 h-4 text-neutral-600 dark:text-neutral-300" />
                        <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">Action</span>
                      </div>
                      {mode === 'action' && <CheckCircle2 className="w-4 h-4 text-[#006BFF] dark:text-blue-400" />}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setMode('auto')}
                      className={cn(
                        "flex items-center justify-between cursor-pointer py-2.5 px-3 my-1 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800",
                        mode === 'auto' && "bg-[#006BFF]/10 dark:bg-blue-500/20"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <Sparkles className="w-4 h-4 text-neutral-600 dark:text-neutral-300" />
                        <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">Auto</span>
                      </div>
                      {mode === 'auto' && <CheckCircle2 className="w-4 h-4 text-[#006BFF] dark:text-blue-400" />}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                
                <div className="flex items-center gap-2 text-[10px] text-neutral-400 dark:text-neutral-500">
                  {messages.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const lastUserMessage = [...messages].reverse().find(m => m.role === 'user');
                        if (lastUserMessage) {
                          handleSend(lastUserMessage.content);
                        }
                      }}
                      className="h-6 px-2 text-[10px] hover:text-[#006BFF] dark:hover:text-blue-400"
                      disabled={isLoading}
                      title="Regenerate last response"
                    >
                      <RefreshCw className="w-3 h-3 mr-1" />
                      Regenerate
                    </Button>
                  )}
                  <span className="font-mono text-neutral-500 dark:text-neutral-400">⌘L</span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// Quick Action Button Component
function QuickActionButton({ icon: Icon, label, onClick }: { icon: any; label: string; onClick: () => void }) {
  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="flex flex-col items-center gap-1.5 p-2.5 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 hover:bg-[#006BFF]/5 dark:hover:bg-blue-500/10 hover:border-[#006BFF]/30 dark:hover:border-blue-500/30 transition-all group"
    >
      <Icon className="w-4 h-4 text-[#006BFF] dark:text-blue-400 group-hover:scale-110 transition-transform" />
      <span className="text-[10px] font-medium text-neutral-700 dark:text-neutral-300">{label}</span>
    </motion.button>
  );
}

function ChatMessageComponent({ 
  message, 
  profile,
  onSuggestionClick,
  onActionClick,
  onExecuteAction,
  mode,
}: { 
  message: ChatMessage; 
  profile?: any;
  onSuggestionClick?: (suggestion: string) => void;
  onActionClick?: (action: { label: string; type: string; data: any }) => void;
  onExecuteAction?: (actionType: string, actionData: any, messageId: string) => void;
  mode?: 'ask' | 'action' | 'auto';
}) {
  const [copied, setCopied] = useState(false);
  const [showTimestamp, setShowTimestamp] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    toast.success('Message copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const formatTime = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(date);
  };

  const getUserInitials = () => {
    const name = profile?.full_name || profile?.name || profile?.email || 'You';
    return name
      .split(' ')
      .map((n: string) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const isUser = message.role === 'user';
  const profilePhoto = (profile as any)?.photoURL || (profile as any)?.photo_url || (profile as any)?.avatar_url;

  return (
    <div
      className={cn(
        "group flex gap-3 py-4 px-1 hover:bg-neutral-50/50 dark:hover:bg-neutral-800/30 transition-colors rounded-lg",
        !isUser && "bg-neutral-50/30 dark:bg-neutral-800/20"
      )}
      onMouseEnter={() => setShowTimestamp(true)}
      onMouseLeave={() => setShowTimestamp(false)}
    >
      {/* Avatar/Icon - Enhanced with Profile Picture */}
      <div className="flex-shrink-0">
        {isUser ? (
          <Avatar className="w-8 h-8 rounded-lg border-2 border-neutral-200 dark:border-neutral-700 shadow-sm">
            <AvatarImage 
              src={profilePhoto} 
              alt={profile?.full_name || profile?.name || 'You'}
              className="object-cover"
            />
            <AvatarFallback className="bg-gradient-to-br from-neutral-200 to-neutral-300 dark:from-neutral-700 dark:to-neutral-800 text-neutral-600 dark:text-neutral-300 text-xs font-semibold rounded-lg">
              {getUserInitials()}
            </AvatarFallback>
          </Avatar>
        ) : (
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#006BFF] to-[#4F46E5] flex items-center justify-center shadow-sm">
            <Bot className="w-4 h-4 text-white" />
          </div>
        )}
      </div>
      
      {/* Content - Enhanced */}
      <div className="flex-1 min-w-0">
        {/* Header with timestamp */}
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
            {isUser ? 'You' : 'TengaLoans AI'}
          </span>
          {showTimestamp && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-[10px] text-neutral-500 dark:text-neutral-400 flex items-center gap-1"
            >
              <Clock className="w-3 h-3" />
              {formatTime(message.timestamp)}
            </motion.span>
          )}
        </div>

        {/* Message Content - Enhanced */}
        <div className={cn(
          "relative rounded-lg px-4 py-3 text-sm leading-relaxed",
          isUser
            ? "bg-gradient-to-br from-[#006BFF] to-[#4F46E5] text-white shadow-sm"
            : "bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 border border-neutral-200 dark:border-neutral-700 shadow-sm"
        )}>
          {/* Copy button for AI messages */}
          {!isUser && (
            <button
              onClick={handleCopy}
              className="absolute top-2 right-2 p-1.5 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 opacity-0 group-hover:opacity-100 transition-opacity"
              title="Copy message"
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 text-green-500" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
          )}

          <div className={cn(
            "whitespace-pre-wrap",
            isUser ? "text-white" : "text-neutral-900 dark:text-neutral-100"
          )}>
            {(typeof message.content === 'string' ? message.content : String(message.content || '')).split('\n').map((line, i) => {
              // Format lists
              if (line.trim().match(/^[-*•]\s+/)) {
                return (
                  <div key={i} className="flex items-start gap-2 mb-1">
                    <span className="text-[#006BFF] dark:text-blue-400 mt-1.5">•</span>
                    <span>{line.replace(/^[-*•]\s+/, '')}</span>
                  </div>
                );
              }
              // Format numbered lists
              if (line.trim().match(/^\d+\.\s+/)) {
                return (
                  <div key={i} className="flex items-start gap-2 mb-1">
                    <span className="text-[#006BFF] dark:text-blue-400 font-semibold">{line.match(/^\d+\./)?.[0]}</span>
                    <span>{line.replace(/^\d+\.\s+/, '')}</span>
                  </div>
                );
              }
              return <p key={i} className={i > 0 ? "mt-2" : ""}>{line || '\u00A0'}</p>;
            })}
          </div>
        </div>

        {/* Data Display - Enhanced */}
        {message.data && !isUser && (
          <div className="mt-3 space-y-2">
            {message.data.overdueLoans && message.data.overdueLoans.length > 0 && (
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                <p className="text-xs font-semibold text-amber-900 dark:text-amber-200 mb-2">
                  {message.data.overdueLoans.length} Overdue Loan{message.data.overdueLoans.length > 1 ? 's' : ''}
                </p>
                <div className="space-y-1.5">
                  {message.data.overdueLoans.slice(0, 3).map((loan: any, idx: number) => (
                    <div key={idx} className="text-xs text-amber-800 dark:text-amber-300 bg-white dark:bg-amber-900/30 rounded px-2 py-1.5">
                      <span className="font-medium">{loan.customerName || 'Unknown'}</span>
                      {' • '}
                      <span className="font-mono">{loan.loanNumber || loan.id.substring(0, 8)}</span>
                      {' • '}
                      <span>{loan.currency || 'ZMW'} {Number(loan.amount || 0).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {message.data.pendingLoans && message.data.pendingLoans.length > 0 && (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                <p className="text-xs font-semibold text-blue-900 dark:text-blue-200 mb-2">
                  {message.data.pendingLoans.length} Pending Loan{message.data.pendingLoans.length > 1 ? 's' : ''}
                </p>
                <div className="space-y-1.5">
                  {message.data.pendingLoans.slice(0, 3).map((loan: any, idx: number) => (
                    <div key={idx} className="text-xs text-blue-800 dark:text-blue-300 bg-white dark:bg-blue-900/30 rounded px-2 py-1.5">
                      <span className="font-medium">{loan.customerName || 'Unknown'}</span>
                      {' • '}
                      <span className="font-mono">{loan.loanNumber || loan.id.substring(0, 8)}</span>
                      {' • '}
                      <span>{loan.currency || 'ZMW'} {Number(loan.amount || 0).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {message.data.portfolioMetrics && (
              <div className="grid grid-cols-2 gap-2 mt-2">
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-2.5">
                  <p className="text-[10px] text-green-700 dark:text-green-300 uppercase tracking-wider mb-1">Total Loans</p>
                  <p className="text-sm font-bold text-green-900 dark:text-green-100">{message.data.portfolioMetrics.totalLoans}</p>
                </div>
                <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-2.5">
                  <p className="text-[10px] text-purple-700 dark:text-purple-300 uppercase tracking-wider mb-1">Total Amount</p>
                  <p className="text-sm font-bold text-purple-900 dark:text-purple-100">
                    {message.data.portfolioMetrics.totalAmount?.toLocaleString() || '0'}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
        
        {/* Pending Action Confirmation - For Action Mode */}
        {message.pendingAction && mode === 'action' && !isUser && (
          <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
            <p className="text-xs font-semibold text-amber-900 dark:text-amber-200 mb-2 flex items-center gap-2">
              <AlertCircle className="w-3.5 h-3.5" />
              Action Ready
            </p>
            <p className="text-xs text-amber-800 dark:text-amber-300 mb-3">
              {message.pendingAction.description}
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => onExecuteAction?.(message.pendingAction!.type, message.pendingAction!.data, message.id)}
                className="h-7 px-3 text-xs bg-green-600 hover:bg-green-700 text-white"
              >
                <CheckCircle2 className="w-3 h-3 mr-1.5" />
                Confirm & Execute
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  // Remove pending action from message
                  const updatedMessage = { ...message };
                  delete updatedMessage.pendingAction;
                }}
                className="h-7 px-3 text-xs border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Actions - Enhanced with Navigation */}
        {message.actions && message.actions.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {message.actions.map((action, index) => (
              <Button
                key={index}
                variant="outline"
                size="sm"
                className="h-7 text-xs border-[#006BFF]/30 dark:border-blue-500/30 text-[#006BFF] dark:text-blue-400 hover:bg-[#006BFF]/10 dark:hover:bg-blue-500/20 hover:border-[#006BFF] dark:hover:border-blue-500 transition-all"
                onClick={() => onActionClick?.(action)}
              >
                {action.label}
              </Button>
            ))}
          </div>
        )}
        
        {/* Suggestions - Enhanced with Click Handler */}
        {message.suggestions && message.suggestions.length > 0 && (
          <div className="mt-3 space-y-1.5">
            <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1.5 flex items-center gap-1.5">
              <Zap className="w-3 h-3" />
              Follow-up questions:
            </p>
            {message.suggestions.map((suggestion, index) => (
              <motion.button
                key={index}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => onSuggestionClick?.(suggestion)}
                className="block w-full text-left text-xs text-[#006BFF] dark:text-blue-400 hover:text-[#0052CC] dark:hover:text-blue-300 hover:bg-[#006BFF]/10 dark:hover:bg-blue-500/20 px-3 py-2 rounded-lg border border-[#006BFF]/20 dark:border-blue-500/30 transition-all hover:shadow-sm active:scale-[0.98]"
              >
                {suggestion}
              </motion.button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

