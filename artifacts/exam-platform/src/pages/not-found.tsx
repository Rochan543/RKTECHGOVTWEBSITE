import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from 'wouter';
import { Home, AlertCircle } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center p-4 bg-gradient-to-br from-slate-50 via-indigo-50/20 to-slate-100 dark:from-slate-950 dark:via-indigo-950/10 dark:to-slate-900">
      <div className="w-full max-w-md bg-card border border-border shadow-xl hover:shadow-2xl transition-shadow duration-300 rounded-3xl p-8 md:p-10 space-y-6 text-center">
        <div className="flex justify-center mb-6">
          <img src="/logo.png" alt="SSC Portal Logo" className="h-20 w-20 object-contain transition-transform hover:scale-105" />
        </div>
        
        <div className="space-y-2">
          <h1 className="text-6xl font-extrabold text-primary tracking-tighter">404</h1>
          <h2 className="text-2xl font-bold text-foreground">Page Not Found</h2>
          <p className="text-sm text-muted-foreground max-w-xs mx-auto">
            The page you are looking for does not exist or has been moved.
          </p>
        </div>

        <div className="pt-4">
          <Button className="w-full py-6 rounded-xl font-bold shadow-md hover:shadow-lg transition-all" asChild>
            <Link href="/dashboard" className="flex items-center justify-center gap-2">
              <Home className="h-4 w-4" /> Go to Dashboard
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
