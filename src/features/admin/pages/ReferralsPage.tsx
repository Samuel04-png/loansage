import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Gift, Copy, Share2, Users, TrendingUp, Award } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../../../hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../../lib/firebase/config';

export function ReferralsPage() {
  const { profile } = useAuth();
  const [copied, setCopied] = useState(false);
  
  // Generate referral code from user ID
  const referralCode = profile?.id ? `TENGALOANS-${profile.id.slice(0, 8).toUpperCase()}` : 'TENGALOANS-XXXX';
  const referralLink = `${window.location.origin}/auth/signup?ref=${referralCode}`;

  // Fetch referral stats
  const { data: referralStats } = useQuery({
    queryKey: ['referral-stats', profile?.id],
    queryFn: async () => {
      if (!profile?.id) return { total: 0, active: 0, rewards: 0 };
      
      try {
        // Get referral count from user document
        const userRef = doc(db, 'users', profile.id);
        const userSnap = await getDoc(userRef);
        const referralCount = userSnap.data()?.referralCount || 0;
        
        // Get active referrals (users who signed up and are active)
        const referralsRef = collection(db, 'referrals');
        const referralsQuery = query(referralsRef, where('referrerId', '==', profile.id));
        const referralsSnapshot = await getDocs(referralsQuery);
        
        let activeCount = 0;
        for (const refDoc of referralsSnapshot.docs) {
          const refData = refDoc.data();
          const userRef = doc(db, 'users', refData.referredUserId);
          const userSnap = await getDoc(userRef);
          if (userSnap.exists() && userSnap.data()?.is_active) {
            activeCount++;
          }
        }
        
        return {
          total: referralCount,
          active: activeCount,
          rewards: 0, // Can be calculated based on active referrals
        };
      } catch (error) {
        console.error('Error fetching referral stats:', error);
        return { total: 0, active: 0, rewards: 0 };
      }
    },
    enabled: !!profile?.id,
  });

  const handleCopy = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    toast.success('Referral link copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join TengaLoans',
          text: 'Check out TengaLoans - the best loan management system!',
          url: referralLink,
        });
        toast.success('Shared successfully!');
      } catch (error) {
        // User cancelled share
      }
    } else {
      handleCopy();
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold text-neutral-900 flex items-center gap-3">
          <Gift className="w-8 h-8 text-[#006BFF]" />
          Referrals
        </h1>
        <p className="text-neutral-600 mt-2">Invite others and earn rewards</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-[#006BFF]" />
              Total Referrals
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-neutral-900">{referralStats?.total || 0}</p>
            <p className="text-sm text-neutral-500 mt-1">People you've referred</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-600" />
              Active Users
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-neutral-900">{referralStats?.active || 0}</p>
            <p className="text-sm text-neutral-500 mt-1">Active referrals</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="w-5 h-5 text-purple-600" />
              Rewards Earned
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-neutral-900">${referralStats?.rewards || 0}</p>
            <p className="text-sm text-neutral-500 mt-1">Total rewards</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your Referral Link</CardTitle>
          <CardDescription>Share this link with others to earn rewards</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-2 p-4 bg-neutral-50 rounded-lg border border-neutral-200">
              <code className="flex-1 text-sm text-neutral-700 break-all">{referralLink}</code>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopy}
                className="gap-2"
              >
                <Copy className="w-4 h-4" />
                {copied ? 'Copied!' : 'Copy'}
              </Button>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleShare} className="flex-1 gap-2">
                <Share2 className="w-4 h-4" />
                Share Link
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>How It Works</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="w-8 h-8 bg-[#006BFF] rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0">
                1
              </div>
              <div>
                <h3 className="font-semibold text-neutral-900">Share Your Link</h3>
                <p className="text-sm text-neutral-600">Send your referral link to friends and colleagues</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="w-8 h-8 bg-[#006BFF] rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0">
                2
              </div>
              <div>
                <h3 className="font-semibold text-neutral-900">They Sign Up</h3>
                <p className="text-sm text-neutral-600">When they create an account using your link, they become your referral</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="w-8 h-8 bg-[#006BFF] rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0">
                3
              </div>
              <div>
                <h3 className="font-semibold text-neutral-900">Earn Rewards</h3>
                <p className="text-sm text-neutral-600">You earn rewards when your referrals become active users</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

