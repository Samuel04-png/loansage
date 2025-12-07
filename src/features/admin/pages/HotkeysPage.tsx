import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
import { Keyboard, Command, Search, Plus, Save, Escape } from 'lucide-react';

const hotkeys = [
  {
    category: 'Navigation',
    keys: [
      { key: '⌘K', description: 'Open command palette / search' },
      { key: '⌘T', description: 'Open themes' },
      { key: '⌘S', description: 'Open settings' },
      { key: '⌘N', description: 'Open notifications' },
    ],
  },
  {
    category: 'Actions',
    keys: [
      { key: '⌘+', description: 'Create new loan' },
      { key: '⌘S', description: 'Save current form' },
      { key: 'Esc', description: 'Close dialog / cancel' },
    ],
  },
  {
    category: 'Shortcuts',
    keys: [
      { key: '⌘1', description: 'Go to Dashboard' },
      { key: '⌘2', description: 'Go to Loans' },
      { key: '⌘3', description: 'Go to Customers' },
      { key: '⌘4', description: 'Go to Employees' },
    ],
  },
];

export function HotkeysPage() {
  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold text-neutral-900 flex items-center gap-3">
          <Keyboard className="w-8 h-8 text-[#006BFF]" />
          Keyboard Shortcuts
        </h1>
        <p className="text-neutral-600 mt-2">Speed up your workflow with keyboard shortcuts</p>
      </div>

      {hotkeys.map((category) => (
        <Card key={category.category}>
          <CardHeader>
            <CardTitle>{category.category}</CardTitle>
            <CardDescription>Keyboard shortcuts for {category.category.toLowerCase()}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {category.keys.map((hotkey, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 rounded-lg border border-neutral-200 hover:bg-neutral-50 transition-colors"
                >
                  <span className="text-neutral-700">{hotkey.description}</span>
                  <kbd className="px-3 py-1.5 text-sm font-semibold text-neutral-700 bg-neutral-100 border border-neutral-300 rounded-lg shadow-sm">
                    {hotkey.key}
                  </kbd>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}

      <Card>
        <CardHeader>
          <CardTitle>Tips</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-neutral-600">
            <li>• Use ⌘K to quickly search for any page or feature</li>
            <li>• Most dialogs can be closed with the Esc key</li>
            <li>• Number shortcuts (⌘1-4) work from any page</li>
            <li>• Shortcuts are case-insensitive</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

