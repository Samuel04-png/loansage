import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Trash2, FileText, Users, Building2, RotateCcw, X } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '../../../components/ui/badge';

const deletedItems = [
  {
    id: '1',
    type: 'loan',
    name: 'Loan #12345',
    deletedAt: '2024-01-15',
    deletedBy: 'Admin User',
    icon: FileText,
  },
  {
    id: '2',
    type: 'customer',
    name: 'John Doe',
    deletedAt: '2024-01-14',
    deletedBy: 'Admin User',
    icon: Users,
  },
];

export function TrashPage() {
  const [items, setItems] = useState(deletedItems);

  const handleRestore = (id: string) => {
    setItems(items.filter(item => item.id !== id));
    // TODO: Implement restore functionality
  };

  const handlePermanentDelete = (id: string) => {
    if (confirm('Are you sure you want to permanently delete this item? This action cannot be undone.')) {
      setItems(items.filter(item => item.id !== id));
      // TODO: Implement permanent delete
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold text-neutral-900 flex items-center gap-3">
          <Trash2 className="w-8 h-8 text-[#006BFF]" />
          Trash
        </h1>
        <p className="text-neutral-600 mt-2">Restore or permanently delete deleted items</p>
      </div>

      {items.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-12">
              <Trash2 className="w-16 h-16 text-neutral-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-neutral-900 mb-2">Trash is empty</h3>
              <p className="text-neutral-500">Deleted items will appear here</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Deleted Items</CardTitle>
            <CardDescription>Items deleted in the last 30 days</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {items.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-4 border border-neutral-200 rounded-lg hover:bg-neutral-50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-neutral-100 rounded-lg flex items-center justify-center">
                        <Icon className="w-5 h-5 text-neutral-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-neutral-900">{item.name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-xs">
                            {item.type}
                          </Badge>
                          <span className="text-xs text-neutral-500">
                            Deleted {item.deletedAt} by {item.deletedBy}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRestore(item.id)}
                        className="gap-2"
                      >
                        <RotateCcw className="w-4 h-4" />
                        Restore
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePermanentDelete(item.id)}
                        className="gap-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <X className="w-4 h-4" />
                        Delete
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

