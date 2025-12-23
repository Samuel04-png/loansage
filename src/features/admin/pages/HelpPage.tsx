import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { HelpCircle, Book, MessageCircle, Video, FileText, Search } from 'lucide-react';
import { useState } from 'react';
import { Input } from '../../../components/ui/input';
import { PrioritySupportBadge } from '../../../components/pricing/PrioritySupportBadge';
import { PrioritySupportInfo } from '../../../components/pricing/PrioritySupportInfo';

const helpCategories = [
  {
    title: 'Getting Started',
    icon: Book,
    articles: [
      'Creating your first loan',
      'Setting up your agency',
      'Adding team members',
      'Understanding the dashboard',
    ],
  },
  {
    title: 'Loans Management',
    icon: FileText,
    articles: [
      'How to create a loan',
      'Approving loan applications',
      'Managing repayments',
      'Handling defaults',
    ],
  },
  {
    title: 'Customer Management',
    icon: MessageCircle,
    articles: [
      'Adding customers',
      'Customer profiles',
      'Communication tools',
      'Document management',
    ],
  },
  {
    title: 'Reports & Analytics',
    icon: Video,
    articles: [
      'Generating reports',
      'Understanding metrics',
      'Exporting data',
      'Custom reports',
    ],
  },
];

export function HelpPage() {
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold text-neutral-900 flex items-center gap-3">
          <HelpCircle className="w-8 h-8 text-[#006BFF]" />
          Help Center
        </h1>
        <p className="text-neutral-600 mt-2">Find answers and learn how to use TengaLoans</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
            <Input
              placeholder="Search for help articles..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-12"
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {helpCategories.map((category) => {
          const Icon = category.icon;
          return (
            <Card key={category.title}>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#006BFF]/10 rounded-lg flex items-center justify-center">
                    <Icon className="w-5 h-5 text-[#006BFF]" />
                  </div>
                  <CardTitle>{category.title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {category.articles.map((article, index) => (
                    <li key={index}>
                      <button className="text-sm text-[#006BFF] hover:underline text-left">
                        {article}
                      </button>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Documentation</CardTitle>
            <CardDescription>Comprehensive guides</CardDescription>
          </CardHeader>
          <CardContent>
            <a 
              href="https://docs.tengaloans.com" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded-xl text-sm font-semibold h-11 md:h-10 px-4 py-2 min-h-[44px] md:min-h-0 border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600 text-neutral-900 dark:text-neutral-100 w-full transition-all duration-300"
            >
              View Docs
            </a>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Video Tutorials</CardTitle>
            <CardDescription>Learn by watching</CardDescription>
          </CardHeader>
          <CardContent>
            <a 
              href="https://youtube.com/tengaloans" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded-xl text-sm font-semibold h-11 md:h-10 px-4 py-2 min-h-[44px] md:min-h-0 border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600 text-neutral-900 dark:text-neutral-100 w-full transition-all duration-300"
            >
              Watch Videos
            </a>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Contact Support
              <PrioritySupportBadge />
            </CardTitle>
            <CardDescription>Get help from our team</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <a 
                href="mailto:support@tengaloans.com"
                className="inline-flex items-center justify-center rounded-xl text-sm font-semibold h-11 md:h-10 px-4 py-2 min-h-[44px] md:min-h-0 border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600 text-neutral-900 dark:text-neutral-100 w-full transition-all duration-300"
              >
                Email Support
              </a>
              <PrioritySupportInfo />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

