/**
 * Upgrade Prompt Component
 * Shows when user tries to access a feature not in their plan
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Link } from 'react-router-dom';
import { Crown, Zap, Lock } from 'lucide-react';

interface UpgradePromptProps {
  feature: string;
  description?: string;
  requiredPlan?: 'professional' | 'enterprise';
}

export function UpgradePrompt({ 
  feature, 
  description,
  requiredPlan = 'professional' 
}: UpgradePromptProps) {
  return (
    <Card className="border-2 border-dashed">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <Lock className="h-6 w-6 text-primary" />
        </div>
        <CardTitle className="text-xl">Upgrade Required</CardTitle>
        <CardDescription>
          {feature} is available on the {requiredPlan === 'enterprise' ? 'Enterprise' : 'Professional'} plan
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {description && (
          <p className="text-sm text-neutral-600 text-center">{description}</p>
        )}
        
        <div className="flex flex-col gap-2">
          <Button asChild className="w-full">
            <Link to="/admin/plans">
              <Zap className="mr-2 h-4 w-4" />
              Upgrade to {requiredPlan === 'enterprise' ? 'Enterprise' : 'Professional'}
            </Link>
          </Button>
          
          {requiredPlan === 'professional' && (
            <Button variant="outline" asChild className="w-full">
              <Link to="/admin/plans">
                <Crown className="mr-2 h-4 w-4" />
                View Enterprise Plan
              </Link>
            </Button>
          )}
        </div>
        
        <p className="text-xs text-neutral-500 text-center">
          Questions? <Link to="/admin/help" className="text-primary hover:underline">Contact Support</Link>
        </p>
      </CardContent>
    </Card>
  );
}

