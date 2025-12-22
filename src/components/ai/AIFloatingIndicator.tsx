/**
 * AI Floating Indicator - Cursor/VSCode Style
 * Top-right floating indicator that shows AI status and alerts
 */

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, AlertTriangle, Loader2, Settings, X, CheckCircle2, Info, AlertCircle } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { cn } from '../../lib/utils';
import { useAIAlerts } from '../../hooks/useAIAlerts';
import { useAITasks } from '../../hooks/useAITasks';

export interface AIFloatingIndicatorProps {
  onChatOpen?: () => void;
  position?: 'top-right' | 'top-left';
}

export function AIFloatingIndicator({ onChatOpen, position = 'top-right' }: AIFloatingIndicatorProps) {
  const { alerts, alertCount, dismissAlert, clearAllAlerts } = useAIAlerts();
  const { status, isRunning, taskProgress } = useAITasks();
  const [isOpen, setIsOpen] = useState(false);
  const indicatorRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (indicatorRef.current && !indicatorRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleClick = () => {
    if (onChatOpen) {
      onChatOpen();
    } else {
      setIsOpen(!isOpen);
    }
  };

  const getIndicatorIcon = () => {
    if (status === 'alert' && alertCount > 0) {
      return <AlertTriangle className="w-5 h-5 text-red-600" />;
    }
    if (status === 'thinking' || isRunning) {
      return <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />;
    }
    if (status === 'task-running') {
      return <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />;
    }
    return <img src="/Tengaloansai.png" alt="AI" className="w-5 h-5 object-contain" />;
  };

  const getIndicatorColor = () => {
    if (status === 'alert' && alertCount > 0) {
      return 'bg-red-50 border-red-200 hover:bg-red-100';
    }
    if (status === 'thinking' || isRunning) {
      return 'bg-blue-50 border-blue-200 hover:bg-blue-100';
    }
    return 'bg-white/80 dark:bg-neutral-800/80 backdrop-blur-sm border-neutral-200 dark:border-neutral-700 hover:bg-white dark:hover:bg-neutral-800';
  };

  const getTooltipText = () => {
    if (status === 'alert' && alertCount > 0) {
      return `${alertCount} issue${alertCount > 1 ? 's' : ''} detected`;
    }
    if (status === 'thinking' || isRunning) {
      return 'AI is analyzing...';
    }
    if (status === 'task-running') {
      return `Running tasks... ${taskProgress || ''}`;
    }
    return 'TengaLoans AI - Click to open chat';
  };

  const criticalAlerts = alerts.filter(a => a.type === 'critical' && !a.dismissed);
  const warningAlerts = alerts.filter(a => a.type === 'warning' && !a.dismissed);
  const infoAlerts = alerts.filter(a => a.type === 'info' && !a.dismissed);

  return (
    <TooltipProvider>
      <div ref={indicatorRef} className="relative">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={handleClick}
              className={cn(
                'relative flex items-center justify-center w-10 h-10 rounded-lg border transition-all duration-200',
                'focus:outline-none focus:ring-2 focus:ring-[#006BFF] focus:ring-offset-2',
                'hover:shadow-md',
                getIndicatorColor()
              )}
              aria-label="AI Assistant"
            >
              {/* Glow effect for ready state */}
              {status === 'ready' && (
                <motion.div
                  className="absolute inset-0 rounded-lg bg-[#006BFF]/10"
                  animate={{
                    opacity: [0.3, 0.6, 0.3],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  }}
                />
              )}

              {/* Pulsing dot for thinking state */}
              {status === 'thinking' && (
                <motion.div
                  className="absolute inset-0 flex items-center justify-center"
                  animate={{
                    scale: [1, 1.2, 1],
                  }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  }}
                >
                  <div className="w-2 h-2 bg-blue-600 rounded-full" />
                </motion.div>
              )}

              {/* Icon */}
              <div className="relative z-10 flex items-center justify-center">
                {getIndicatorIcon()}
              </div>

              {/* Alert Badge */}
              {alertCount > 0 && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute -top-1 -right-1 z-20"
                >
                  <Badge
                    variant="destructive"
                    className="h-5 w-5 flex items-center justify-center p-0 text-xs font-bold rounded-full"
                  >
                    {alertCount > 9 ? '9+' : alertCount}
                  </Badge>
                </motion.div>
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            {getTooltipText()}
          </TooltipContent>
        </Tooltip>

        {/* Alert Dropdown */}
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className={cn(
                'absolute z-50 mt-2 w-80 rounded-lg border border-neutral-200 bg-white shadow-lg',
                position === 'top-right' ? 'right-0' : 'left-0'
              )}
            >
              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-[#006BFF]" />
                    <h3 className="text-sm font-semibold text-neutral-900">AI Alerts</h3>
                    {alertCount > 0 && (
                      <Badge variant="destructive" className="text-xs">
                        {alertCount}
                      </Badge>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsOpen(false)}
                    className="h-6 w-6 p-0"
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>

                {alertCount === 0 ? (
                  <div className="py-8 text-center">
                    <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                    <p className="text-sm text-neutral-600">All systems operating normally</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {/* Critical Alerts */}
                    {criticalAlerts.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-red-600 mb-1 uppercase tracking-wide">
                          Critical
                        </p>
                        {criticalAlerts.map((alert) => (
                          <AlertItem
                            key={alert.id}
                            alert={alert}
                            onDismiss={() => dismissAlert(alert.id)}
                          />
                        ))}
                      </div>
                    )}

                    {/* Warning Alerts */}
                    {warningAlerts.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-amber-600 mb-1 uppercase tracking-wide">
                          Warnings
                        </p>
                        {warningAlerts.map((alert) => (
                          <AlertItem
                            key={alert.id}
                            alert={alert}
                            onDismiss={() => dismissAlert(alert.id)}
                          />
                        ))}
                      </div>
                    )}

                    {/* Info Alerts */}
                    {infoAlerts.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-blue-600 mb-1 uppercase tracking-wide">
                          Info
                        </p>
                        {infoAlerts.map((alert) => (
                          <AlertItem
                            key={alert.id}
                            alert={alert}
                            onDismiss={() => dismissAlert(alert.id)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {alertCount > 0 && (
                  <div className="mt-3 pt-3 border-t border-neutral-200">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={clearAllAlerts}
                      className="w-full text-xs"
                    >
                      Clear All Alerts
                    </Button>
                  </div>
                )}

                <div className="mt-3 pt-3 border-t border-neutral-200">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setIsOpen(false);
                      if (onChatOpen) onChatOpen();
                    }}
                    className="w-full text-xs justify-start"
                  >
                    <img src="/Tengaloansai.png" alt="AI" className="w-3 h-3 mr-2 object-contain" />
                    Open AI Chat
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </TooltipProvider>
  );
}

interface AlertItemProps {
  alert: {
    id: string;
    type: 'critical' | 'warning' | 'info';
    title: string;
    message: string;
    timestamp: Date;
    action?: {
      label: string;
      type: string;
      data: any;
    };
  };
  onDismiss: () => void;
}

function AlertItem({ alert, onDismiss }: AlertItemProps) {
  const getIcon = () => {
    switch (alert.type) {
      case 'critical':
        return <AlertCircle className="w-4 h-4 text-red-600" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-amber-600" />;
      default:
        return <Info className="w-4 h-4 text-blue-600" />;
    }
  };

  const getBgColor = () => {
    switch (alert.type) {
      case 'critical':
        return 'bg-red-50 border-red-200';
      case 'warning':
        return 'bg-amber-50 border-amber-200';
      default:
        return 'bg-blue-50 border-blue-200';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className={cn('p-3 rounded-lg border', getBgColor())}
    >
      <div className="flex items-start gap-2">
        <div className="flex-shrink-0 mt-0.5">{getIcon()}</div>
        <div className="flex-1 min-w-0">
          <h4 className="text-xs font-semibold text-neutral-900 mb-1">{alert.title}</h4>
          <p className="text-xs text-neutral-600 mb-2">{alert.message}</p>
          {alert.action && (
            <Button
              variant="outline"
              size="sm"
              className="h-6 text-xs"
              onClick={() => {
                // Handle action
                onDismiss();
              }}
            >
              {alert.action.label}
            </Button>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onDismiss}
          className="h-6 w-6 p-0 flex-shrink-0"
        >
          <X className="w-3 h-3" />
        </Button>
      </div>
    </motion.div>
  );
}

