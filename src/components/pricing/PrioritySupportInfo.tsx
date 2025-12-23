import { useFeatureGate } from '../../hooks/useFeatureGate';
import { Card, CardContent } from '../ui/card';
import { Crown, Mail, Phone, Clock } from 'lucide-react';

export function PrioritySupportInfo() {
  const { plan } = useFeatureGate();

  if (plan !== 'enterprise') {
    return null;
  }

  return (
    <Card className="bg-gradient-to-br from-[#006BFF]/10 to-[#4F46E5]/10 border-[#006BFF]/20">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <Crown className="w-5 h-5 text-[#006BFF] flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-semibold text-sm mb-1 flex items-center gap-2">
              Priority Support
              <span className="text-xs text-[#006BFF] bg-[#006BFF]/20 px-2 py-0.5 rounded-full">
                Enterprise
              </span>
            </h4>
            <p className="text-xs text-neutral-600 dark:text-neutral-400 mb-2">
              You have priority support with faster response times (typically within 2-4 hours).
            </p>
            <div className="space-y-1 text-xs">
              <div className="flex items-center gap-2 text-neutral-600 dark:text-neutral-400">
                <Mail className="w-3 h-3" />
                <span>priority@tengaloans.com</span>
              </div>
              <div className="flex items-center gap-2 text-neutral-600 dark:text-neutral-400">
                <Clock className="w-3 h-3" />
                <span>Response time: 2-4 hours (business days)</span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

