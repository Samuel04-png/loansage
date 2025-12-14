/**
 * AI Chat Panel - Resizable side panel for AI conversations
 * Cursor/VSCode style integration
 */

import { useState, useEffect, useRef } from 'react';
import { X, Send, Sparkles, Loader2, Info, Copy, Check, User, Bot, Clock, Trash2, Download, RefreshCw, Zap, TrendingUp, AlertCircle, FileText, Users, DollarSign, BarChart3 } from 'lucide-react';
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

interface AIChatPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  position?: 'right' | 'left';
  defaultWidth?: number;
  onWidthChange?: (width: number) => void;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  data?: any;
  suggestions?: string[];
  actions?: Array<{ label: string; type: string; data: any }>;
}

export function AIChatPanel({
  open,
  onOpenChange,
  position = 'right',
  defaultWidth = 375,
  onWidthChange,
}: AIChatPanelProps) {
  const { profile } = useAuth();
  const { agency } = useAgency();
  const navigate = useNavigate();
  
  // Persist panel width in localStorage
  const [width, setWidth] = useState(() => {
    const saved = localStorage.getItem('ai-chat-panel-width');
    return saved ? parseInt(saved, 10) : defaultWidth;
  });
  
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

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
      const response = await askLoanOfficerAssistant({
        question: userMessage.content,
        context: {
          agencyId: profile.agency_id,
          userId: profile.id,
        },
      });

      const aiMessage: ChatMessage = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        content: response.answer,
        timestamp: new Date(),
        data: response.data,
        suggestions: response.suggestions,
        actions: response.actions,
      };

      setMessages((prev) => [...prev, aiMessage]);
    } catch (error: any) {
      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: `Error: ${error.message || 'Failed to get AI response'}`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
      toast.error('Failed to get AI response. Please try again.');
    } finally {
      setIsLoading(false);
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
    a.download = `loansage-ai-chat-${new Date().toISOString().split('T')[0]}.txt`;
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
                <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">LoanSage AI</h3>
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
                      <h4 className="text-base font-semibold text-neutral-900 dark:text-neutral-100 mb-2">LoanSage AI Assistant</h4>
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

          {/* Input - Enhanced VS Code/Cursor style - Always visible at bottom */}
          <div className="p-4 border-t border-neutral-200 dark:border-neutral-800 bg-gradient-to-r from-white to-neutral-50/50 dark:from-[#1E293B] dark:to-[#1E293B]/80 backdrop-blur-sm flex-shrink-0">
            <div className="flex items-end gap-2">
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
                  placeholder="Ask about loans, customers, portfolio..."
                  className="pr-12 h-10 bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 focus:border-[#006BFF] dark:focus:border-blue-500 focus:ring-2 focus:ring-[#006BFF]/20 dark:focus:ring-blue-500/30 focus:bg-white dark:focus:bg-neutral-800 text-sm text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-500 dark:placeholder:text-neutral-400 rounded-lg shadow-sm"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-neutral-400 dark:text-neutral-500">
                  ⏎
                </div>
              </div>
              <Button
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                size="sm"
                className="h-10 w-10 p-0 bg-gradient-to-r from-[#006BFF] to-[#4F46E5] hover:from-[#0052CC] hover:to-[#4338CA] text-white shadow-md hover:shadow-lg transition-all rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </div>
            <div className="mt-2 flex items-center justify-between text-[10px] text-neutral-400 dark:text-neutral-500">
              <div className="flex items-center gap-1.5">
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
                    className="h-5 px-2 text-[10px] text-neutral-500 dark:text-neutral-400 hover:text-[#006BFF] dark:hover:text-blue-400"
                    disabled={isLoading}
                    title="Regenerate last response"
                  >
                    <RefreshCw className="w-3 h-3 mr-1" />
                    Regenerate
                  </Button>
                )}
                <Info className="w-3 h-3" />
                <span>Enter to send</span>
              </div>
              <span className="font-mono">⌘L to toggle</span>
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
}: { 
  message: ChatMessage; 
  profile?: any;
  onSuggestionClick?: (suggestion: string) => void;
  onActionClick?: (action: { label: string; type: string; data: any }) => void;
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
            {isUser ? 'You' : 'LoanSage AI'}
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
            {message.content.split('\n').map((line, i) => {
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

