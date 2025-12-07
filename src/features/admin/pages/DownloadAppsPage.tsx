import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Download, Smartphone, Monitor, Tablet, ExternalLink, Apple, Chrome } from 'lucide-react';

const apps = [
  {
    platform: 'iOS',
    icon: Apple,
    description: 'Download for iPhone and iPad',
    status: 'Coming Soon',
    color: 'bg-black',
  },
  {
    platform: 'Android',
    icon: Smartphone,
    description: 'Download for Android devices',
    status: 'Coming Soon',
    color: 'bg-green-600',
  },
  {
    platform: 'Desktop',
    icon: Monitor,
    description: 'Download for Windows, Mac, and Linux',
    status: 'Available',
    color: 'bg-blue-600',
  },
  {
    platform: 'Web App',
    icon: Chrome,
    description: 'Add to home screen for quick access',
    status: 'Available',
    color: 'bg-purple-600',
  },
];

export function DownloadAppsPage() {
  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold text-neutral-900 flex items-center gap-3">
          <Download className="w-8 h-8 text-[#006BFF]" />
          Download Apps
        </h1>
        <p className="text-neutral-600 mt-2">Access LoanSage on all your devices</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {apps.map((app) => {
          const Icon = app.icon;
          return (
            <Card key={app.platform}>
              <CardHeader>
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 ${app.color} rounded-lg flex items-center justify-center`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <CardTitle>{app.platform}</CardTitle>
                    <CardDescription>{app.description}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <span className={`text-sm font-medium ${
                    app.status === 'Available' ? 'text-green-600' : 'text-neutral-500'
                  }`}>
                    {app.status}
                  </span>
                  <Button
                    variant={app.status === 'Available' ? 'default' : 'outline'}
                    disabled={app.status === 'Coming Soon'}
                    className="gap-2"
                  >
                    {app.status === 'Available' ? (
                      <>
                        <Download className="w-4 h-4" />
                        Download
                      </>
                    ) : (
                      'Coming Soon'
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Web App Installation</CardTitle>
          <CardDescription>Add LoanSage to your home screen for quick access</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <h3 className="font-semibold text-blue-900 mb-2">For Mobile Devices:</h3>
              <ol className="list-decimal list-inside space-y-1 text-blue-800 text-sm">
                <li>Open LoanSage in your browser</li>
                <li>Tap the menu button (three dots)</li>
                <li>Select "Add to Home Screen"</li>
                <li>Launch LoanSage like a native app</li>
              </ol>
            </div>
            <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
              <h3 className="font-semibold text-purple-900 mb-2">For Desktop:</h3>
              <ol className="list-decimal list-inside space-y-1 text-purple-800 text-sm">
                <li>Open LoanSage in Chrome or Edge</li>
                <li>Click the install icon in the address bar</li>
                <li>Follow the installation prompts</li>
                <li>Launch from your applications menu</li>
              </ol>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

