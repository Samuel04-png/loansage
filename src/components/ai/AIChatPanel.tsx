/**
 * AI Chat Panel - Resizable side panel for AI conversations
 * Cursor/VSCode style integration
 */

import { useState, useEffect, useRef } from 'react';
import { X, Send, Sparkles, Loader2, Info } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { cn } from '../../lib/utils';
import { askLoanOfficerAssistant, getCommonQueries } from '../../lib/ai/loan-officer-assistant';
import { useAuth } from '../../hooks/useAuth';
import { useAgency } from '../../hooks/useAgency';
import type { AssistantResponse } from '../../lib/ai/loan-officer-assistant';

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

  const handleSend = async () => {
    if (!input.trim() || isLoading || !profile?.agency_id) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: input.trim(),
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
    } finally {
      setIsLoading(false);
    }
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
          {/* Header - VS Code/Cursor style */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-neutral-200 dark:border-neutral-800 flex-shrink-0 bg-white dark:bg-[#1E293B]">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded bg-gradient-to-br from-[#006BFF] to-[#4F46E5] flex items-center justify-center">
                <Sparkles className="w-3 h-3 text-white" />
              </div>
              <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">LoanSage AI</h3>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="h-7 w-7 p-0 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100"
              title="Close panel"
            >
              <X className="w-4 h-4" />
            </Button>
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
            <div className="px-4 py-2">
              {messages.length === 0 && (
                <div className="py-8">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded bg-gradient-to-br from-[#006BFF] to-[#4F46E5] flex items-center justify-center">
                      <Sparkles className="w-4 h-4 text-white" />
                    </div>
                    <h4 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">LoanSage AI Assistant</h4>
                  </div>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4 leading-relaxed">
                    Ask me anything about your loan portfolio. I can analyze loans, customers, payments, and provide insights on demand.
                  </p>
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-2">Example questions:</p>
                    {commonQueries.slice(0, 4).map((query, index) => (
                      <button
                        key={index}
                        onClick={() => setInput(query)}
                        className="block w-full text-left text-xs text-[#006BFF] dark:text-blue-400 hover:text-[#0052CC] dark:hover:text-blue-300 hover:bg-[#006BFF]/5 dark:hover:bg-blue-500/10 px-3 py-2 rounded transition-colors"
                      >
                        {query}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((message) => (
                <ChatMessageComponent key={message.id} message={message} />
              ))}

              {isLoading && (
                <div className="flex items-center gap-2 py-4 text-neutral-500 dark:text-neutral-400">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">Thinking...</span>
                </div>
              )}

              <div ref={messagesEndRef} className="h-1" />
            </div>
          </div>

          {/* Input - VS Code/Cursor style - Always visible at bottom */}
          <div className="p-3 border-t border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#1E293B] flex-shrink-0">
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
                      className="pr-10 bg-neutral-50 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 focus:border-[#006BFF] dark:focus:border-blue-500 focus:bg-white dark:focus:bg-neutral-800 text-sm text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-500 dark:placeholder:text-neutral-400"
                />
              </div>
              <Button
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                size="sm"
                className="h-9 px-3 bg-[#006BFF] hover:bg-[#0052CC] text-white"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </div>
            <div className="mt-1.5 flex items-center gap-1.5 text-xs text-neutral-400 dark:text-neutral-500">
              <Info className="w-3 h-3" />
              <span>Enter to send • ⌘L to toggle</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function ChatMessageComponent({ message }: { message: ChatMessage }) {
  return (
    <div className="flex gap-3 py-3 border-b border-neutral-100 dark:border-neutral-800 last:border-0">
      {/* Avatar/Icon */}
      <div className="flex-shrink-0 mt-0.5">
        {message.role === 'assistant' ? (
          <div className="w-6 h-6 rounded bg-[#006BFF]/10 flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5 text-[#006BFF]" />
          </div>
        ) : (
          <div className="w-6 h-6 rounded bg-neutral-200 flex items-center justify-center">
            <span className="text-xs font-medium text-neutral-600 dark:text-neutral-400">You</span>
          </div>
        )}
      </div>
      
      {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="text-sm text-neutral-900 dark:text-neutral-100 whitespace-pre-wrap leading-relaxed">
              {message.content}
            </div>
        
        {/* Actions */}
        {message.actions && message.actions.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {message.actions.map((action, index) => (
              <Button
                key={index}
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => {
                  console.log('Action:', action);
                }}
              >
                {action.label}
              </Button>
            ))}
          </div>
        )}
        
        {/* Suggestions */}
        {message.suggestions && message.suggestions.length > 0 && (
          <div className="mt-3 space-y-1">
            {message.suggestions.map((suggestion, index) => (
              <button
                key={index}
                className="block w-full text-left text-xs text-[#006BFF] hover:text-[#0052CC] hover:bg-[#006BFF]/5 px-2 py-1.5 rounded transition-colors"
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

