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
    <div className="min-h-screen grid grid-cols-1 md:grid-cols-2 bg-background">
      <div className="flex items-center justify-center p-8">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center">
            <div className="flex justify-center mb-4">
              <div className="h-12 w-12 bg-primary text-primary-foreground rounded-xl flex items-center justify-center">
                <ShieldCheck className="h-8 w-8" />
              </div>
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Sign in to your account</h1>
            <p className="text-muted-foreground mt-2">Ready to conquer your next exam?</p>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email address</FormLabel>
                    <FormControl>
                      <Input placeholder="student@example.com" {...field} />
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
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="••••••••" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="flex items-center justify-between">
                <Link href="/forgot-password" className="text-sm font-medium text-primary hover:underline">
                  Forgot password?
                </Link>
              </div>

              <Button type="submit" className="w-full" disabled={loginMutation.isPending}>
                {loginMutation.isPending ? 'Signing in...' : 'Sign in'}
              </Button>
            </form>
          </Form>

          <p className="text-center text-sm text-muted-foreground">
            Don't have an account?{' '}
            <Link href="/register" className="font-semibold text-primary hover:underline">
              Register here
            </Link>
          </p>
        </div>
      </div>
      <div className="hidden md:flex flex-col justify-center items-center bg-indigo-900 text-white p-12">
        <div className="max-w-md">
          <h2 className="text-4xl font-bold mb-6 text-white leading-tight">The ultimate testing ground for serious aspirants.</h2>
          <ul className="space-y-4 text-indigo-200 text-lg">
            <li className="flex items-center gap-3">
              <div className="h-2 w-2 rounded-full bg-indigo-400" />
              Real exam interface simulation
            </li>
            <li className="flex items-center gap-3">
              <div className="h-2 w-2 rounded-full bg-indigo-400" />
              Detailed subject-wise analytics
            </li>
            <li className="flex items-center gap-3">
              <div className="h-2 w-2 rounded-full bg-indigo-400" />
              All India Rank & Leaderboards
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
