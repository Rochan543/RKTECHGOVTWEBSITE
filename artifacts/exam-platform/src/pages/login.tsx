import { useState } from 'react';
import { useLocation, Link } from 'wouter';
import { useAuth } from '@/lib/auth';
import { useLogin } from '@workspace/api-client-react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { ShieldCheck } from 'lucide-react';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export default function Login() {
  const [, setLocation] = useLocation();
  const { login } = useAuth();
  const { toast } = useToast();
  
  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const loginMutation = useLogin();

  const onSubmit = (data: z.infer<typeof loginSchema>) => {
    loginMutation.mutate({ data }, {
      onSuccess: (res) => {
        login(res.token, res.user);
        toast({ title: 'Welcome back!' });
        if (res.user.role === 'admin' || res.user.role === 'super_admin') {
          setLocation('/admin');
        } else {
          setLocation('/dashboard');
        }
      },
      onError: (err) => {
        toast({
          title: 'Login failed',
          description: (err.data as { error?: string })?.error || 'Invalid credentials',
          variant: 'destructive',
        });
      }
    });
  };

  return (
    <div className="min-h-screen grid grid-cols-1 md:grid-cols-2 bg-gradient-to-br from-slate-50 via-indigo-50/20 to-slate-100 dark:from-slate-950 dark:via-indigo-950/10 dark:to-slate-900">
      <div className="flex items-center justify-center p-6 md:p-12">
        <div className="w-full max-w-md bg-card border border-border shadow-xl hover:shadow-2xl transition-shadow duration-300 rounded-3xl p-8 md:p-10 space-y-8">
          <div className="text-center">
            <div className="flex justify-center mb-6">
              <img src="/logo.png" alt="SSC Portal Logo" className="h-20 w-20 object-contain transition-transform hover:scale-105" />
            </div>
            <h2 className="text-4xl font-extrabold tracking-tight text-foreground">RK TECH Portal</h2>
            <p className="text-sm text-muted-foreground mt-2 font-medium">Sign in to your account to continue</p>
          </div>
 
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-semibold text-foreground">Email address</FormLabel>
                    <FormControl>
                      <Input placeholder="student@example.com" {...field} className="rounded-xl border-slate-200/80 focus:border-primary" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-semibold text-foreground">Password</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="••••••••" {...field} className="rounded-xl border-slate-200/80 focus:border-primary" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="flex items-center justify-end">
                <Link href="/forgot-password" className="text-sm font-semibold text-primary hover:text-indigo-700 transition-colors">
                  Forgot password?
                </Link>
              </div>
 
              <Button type="submit" className="w-full py-6 rounded-xl font-bold shadow-md hover:shadow-lg transition-all" disabled={loginMutation.isPending}>
                {loginMutation.isPending ? 'Signing in...' : 'Sign in'}
              </Button>
            </form>
          </Form>
 
          <p className="text-center text-sm text-muted-foreground">
            Don't have an account?{' '}
            <Link href="/register" className="font-bold text-primary hover:text-indigo-700 transition-colors">
              Register here
            </Link>
          </p>
        </div>
      </div>
      <div className="hidden md:flex flex-col justify-center items-center bg-gradient-to-br from-indigo-900 to-indigo-950 text-white p-12 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(99,102,241,0.15),transparent)] pointer-events-none" />
        <div className="max-w-md relative z-10 space-y-6">
          <h2 className="text-4xl font-extrabold text-white leading-tight">The ultimate testing ground for serious aspirants.</h2>
          <ul className="space-y-4 text-indigo-200 text-lg font-medium">
            <li className="flex items-center gap-3">
              <div className="h-2.5 w-2.5 rounded-full bg-indigo-400 shrink-0" />
              Real exam interface simulation
            </li>
            <li className="flex items-center gap-3">
              <div className="h-2.5 w-2.5 rounded-full bg-indigo-400 shrink-0" />
              Detailed subject-wise analytics
            </li>
            <li className="flex items-center gap-3">
              <div className="h-2.5 w-2.5 rounded-full bg-indigo-400 shrink-0" />
              All India Rank & Leaderboards
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
