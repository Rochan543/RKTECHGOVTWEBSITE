import { useLocation, Link } from 'wouter';
import { useAuth } from '@/lib/auth';
import { useRegister } from '@workspace/api-client-react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { ShieldCheck } from 'lucide-react';

const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export default function Register() {
  const [, setLocation] = useLocation();
  const { login } = useAuth();
  const { toast } = useToast();
  
  const form = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: '', email: '', password: '' },
  });

  const registerMutation = useRegister();

  const onSubmit = (data: z.infer<typeof registerSchema>) => {
    registerMutation.mutate({ data }, {
      onSuccess: (res) => {
        login(res.token, res.user);
        toast({ title: 'Account created successfully!' });
        setLocation('/dashboard');
      },
      onError: (err) => {
        toast({
          title: 'Registration failed',
          description: (err.data as { error?: string })?.error || 'Something went wrong',
          variant: 'destructive',
        });
      }
    });
  };

  return (
    <div className="min-h-screen grid grid-cols-1 md:grid-cols-2 bg-gradient-to-br from-slate-50 via-indigo-50/20 to-slate-100 dark:from-slate-950 dark:via-indigo-950/10 dark:to-slate-900">
      <div className="hidden md:flex flex-col justify-center items-center bg-gradient-to-br from-indigo-900 to-indigo-950 text-white p-12 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(99,102,241,0.15),transparent)] pointer-events-none" />
        <div className="max-w-md relative z-10 space-y-6">
          <h2 className="text-4xl font-extrabold text-white leading-tight">Begin your preparation journey today.</h2>
          <p className="text-indigo-200 text-lg font-medium leading-relaxed">
            Join thousands of successful candidates who trusted our platform for their SSC, Banking, and Railway exams.
          </p>
        </div>
      </div>
      <div className="flex items-center justify-center p-6 md:p-12">
        <div className="w-full max-w-md bg-card border border-border shadow-xl hover:shadow-2xl transition-shadow duration-300 rounded-3xl p-8 md:p-10 space-y-8">
          <div className="text-center">
            <div className="flex justify-center mb-6">
              <img src="/logo.png" alt="SSC Portal Logo" className="h-20 w-20 object-contain transition-transform hover:scale-105" />
            </div>
            <h2 className="text-4xl font-extrabold tracking-tight text-foreground">RK TECH Portal</h2>
            <p className="text-sm text-muted-foreground mt-2 font-medium">Get started with your profile today</p>
          </div>
 
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-semibold text-foreground">Full Name</FormLabel>
                    <FormControl>
                      <Input placeholder="John Doe" {...field} className="rounded-xl border-slate-200/80 focus:border-primary" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
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
              
              <Button type="submit" className="w-full py-6 rounded-xl font-bold shadow-md hover:shadow-lg transition-all mt-6" disabled={registerMutation.isPending}>
                {registerMutation.isPending ? 'Creating account...' : 'Register'}
              </Button>
            </form>
          </Form>
 
          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{' '}
            <Link href="/login" className="font-bold text-primary hover:text-indigo-700 transition-colors">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
