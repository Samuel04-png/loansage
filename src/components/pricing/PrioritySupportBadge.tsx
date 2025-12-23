import { Badge } from '../ui/badge';
import { Crown } from 'lucide-react';
import { useFeatureGate } from '../../hooks/useFeatureGate';

export function PrioritySupportBadge() {
  const { plan } = useFeatureGate();

  if (plan !== 'enterprise') {
    return null;
  }

  return (
    <Badge variant="default" className="bg-gradient-to-r from-[#006BFF] to-[#4F46E5] text-white">
      <Crown className="w-3 h-3 mr-1" />
      Priority Support
    </Badge>
  );
}

