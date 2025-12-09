import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../lib/firebase/config';
import { useAuth } from '../../../hooks/useAuth';
import { useAgency } from '../../../hooks/useAgency';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Badge } from '../../../components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../components/ui/table';
import {
  DollarSign,
  RefreshCw,
  Save,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Globe,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { SUPPORTED_CURRENCIES, getCurrency, convertCurrency } from '../../../lib/currency/currency-helpers';
import { formatCurrencyWithSymbol } from '../../../lib/currency/currency-helpers';

function CurrencyRow({ currency, rate, baseCurrency, onUpdateRate, isUpdating, testConversion }: {
  currency: any;
  rate: number;
  baseCurrency: string;
  onUpdateRate: (rate: number) => void;
  isUpdating: boolean;
  testConversion: (from: string, to: string, amount?: number) => number;
}) {
  const [localRate, setLocalRate] = useState<string>(rate.toString());

  return (
    <TableRow>
      <TableCell>
        <div>
          <p className="font-semibold">{currency.code}</p>
          <p className="text-xs text-neutral-500">{currency.name}</p>
        </div>
      </TableCell>
      <TableCell>
        <Badge variant="outline">{currency.symbol}</Badge>
      </TableCell>
      <TableCell>
        <Input
          type="number"
          value={localRate}
          onChange={(e) => setLocalRate(e.target.value)}
          step="0.0001"
          className="w-32"
        />
      </TableCell>
      <TableCell>
        {currency.code === baseCurrency ? (
          <span className="text-neutral-500">Base currency</span>
        ) : (
          <span className="font-mono">
            {formatCurrencyWithSymbol(
              testConversion(baseCurrency, currency.code, 1000),
              currency.code
            )}
          </span>
        )}
      </TableCell>
      <TableCell>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            const numRate = parseFloat(localRate);
            if (isNaN(numRate) || numRate <= 0) {
              toast.error('Invalid exchange rate');
              return;
            }
            onUpdateRate(numRate);
          }}
          disabled={isUpdating}
        >
          {isUpdating ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
        </Button>
      </TableCell>
    </TableRow>
  );
}

export function CurrencySettingsPage() {
  const { profile } = useAuth();
  const { agency } = useAgency();
  const queryClient = useQueryClient();
  const [exchangeRates, setExchangeRates] = useState<Record<string, number>>(() => {
    if (agency?.exchange_rates) {
      return agency.exchange_rates;
    } else {
      const defaults: Record<string, number> = {};
      SUPPORTED_CURRENCIES.forEach(curr => {
        defaults[curr.code] = curr.exchangeRate;
      });
      return defaults;
    }
  });
  const [baseCurrency, setBaseCurrency] = useState<string>(agency?.base_currency || 'ZMW');

  const updateExchangeRate = useMutation({
    mutationFn: async ({ currency, rate }: { currency: string; rate: number }) => {
      if (!profile?.agency_id) throw new Error('Agency not found');
      
      const updatedRates = { ...exchangeRates, [currency]: rate };
      const agencyRef = doc(db, 'agencies', profile.agency_id);
      
      await updateDoc(agencyRef, {
        exchange_rates: updatedRates,
        base_currency: baseCurrency,
        updatedAt: serverTimestamp(),
      });
      
      setExchangeRates(updatedRates);
    },
    onSuccess: () => {
      toast.success('Exchange rates updated successfully');
      queryClient.invalidateQueries({ queryKey: ['agency'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update exchange rates');
    },
  });

  const updateBaseCurrency = useMutation({
    mutationFn: async (currency: string) => {
      if (!profile?.agency_id) throw new Error('Agency not found');
      
      const agencyRef = doc(db, 'agencies', profile.agency_id);
      await updateDoc(agencyRef, {
        base_currency: currency,
        updatedAt: serverTimestamp(),
      });
      
      setBaseCurrency(currency);
    },
    onSuccess: () => {
      toast.success('Base currency updated successfully');
      queryClient.invalidateQueries({ queryKey: ['agency'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update base currency');
    },
  });

  const testConversion = (from: string, to: string, amount: number = 1000) => {
    return convertCurrency(amount, from, to, exchangeRates);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-neutral-900 flex items-center gap-3">
          <Globe className="w-8 h-8 text-[#006BFF]" />
          Multi-Currency Settings
        </h1>
        <p className="text-neutral-600 mt-2">Configure supported currencies and exchange rates</p>
      </div>

      {/* Base Currency */}
      <Card>
        <CardHeader>
          <CardTitle>Base Currency</CardTitle>
          <CardDescription>Set your primary currency for all operations</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <select
              value={baseCurrency}
              onChange={(e) => updateBaseCurrency.mutate(e.target.value)}
              className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {SUPPORTED_CURRENCIES.map(currency => (
                <option key={currency.code} value={currency.code}>
                  {currency.code} - {currency.name}
                </option>
              ))}
            </select>
            <Badge variant="outline" className="text-lg">
              {getCurrency(baseCurrency)?.symbol} {baseCurrency}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Exchange Rates */}
      <Card>
        <CardHeader>
          <CardTitle>Exchange Rates</CardTitle>
          <CardDescription>Configure exchange rates relative to base currency ({baseCurrency})</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Currency</TableHead>
                <TableHead>Symbol</TableHead>
                <TableHead>Exchange Rate</TableHead>
                <TableHead>Example (1000 {baseCurrency})</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {SUPPORTED_CURRENCIES.map(currency => {
                const rate = exchangeRates[currency.code] || currency.exchangeRate;
                return (
                  <CurrencyRow
                    key={currency.code}
                    currency={currency}
                    rate={rate}
                    baseCurrency={baseCurrency}
                    onUpdateRate={(newRate) => updateExchangeRate.mutate({ currency: currency.code, rate: newRate })}
                    isUpdating={updateExchangeRate.isPending}
                    testConversion={testConversion}
                  />
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Currency Conversion Tool */}
      <Card>
        <CardHeader>
          <CardTitle>Currency Conversion Tool</CardTitle>
          <CardDescription>Test currency conversions with current exchange rates</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>From Currency</Label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-2">
                {SUPPORTED_CURRENCIES.map(currency => (
                  <option key={currency.code} value={currency.code}>
                    {currency.code}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Amount</Label>
              <Input type="number" placeholder="1000" className="mt-2" />
            </div>
            <div>
              <Label>To Currency</Label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-2">
                {SUPPORTED_CURRENCIES.map(currency => (
                  <option key={currency.code} value={currency.code}>
                    {currency.code}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Info */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
            <div>
              <h4 className="font-semibold text-blue-900 mb-1">About Exchange Rates</h4>
              <p className="text-sm text-blue-800">
                Exchange rates are relative to your base currency. All loans and transactions will be displayed
                in the selected base currency, but you can convert amounts using the configured exchange rates.
                Update rates regularly to ensure accurate conversions.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

