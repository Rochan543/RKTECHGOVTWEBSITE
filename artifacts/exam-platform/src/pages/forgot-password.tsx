import { useLocation, Link } from 'wouter';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { useForgotPassword } from '@workspace/api-client-react';
import { ShieldCheck, ArrowLeft } from 'lucide-react';

const schema = z.object({
  email: z.string().email('Please enter a valid email'),
});

export default function ForgotPassword() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { email: '' },
  });

  const mutation = useForgotPassword();

  const onSubmit = (data: z.infer<typeof schema>) => {
    mutation.mutate({ data }, {
      onSuccess: () => {
        toast({ title: 'Password reset email sent. Please check your inbox.' });
        setLocation('/login');
      },
      onError: (err) => {
        toast({
          title: 'Request failed',
          description: (err.data as { error?: string })?.error || 'Something went wrong',
          variant: 'destructive',
        });
      }
    });
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-br from-slate-50 via-indigo-50/20 to-slate-100 dark:from-slate-950 dark:via-indigo-950/10 dark:to-slate-900">
      <div className="w-full max-w-md bg-card border border-border shadow-xl hover:shadow-2xl transition-shadow duration-300 rounded-3xl p-8 md:p-10 space-y-6">
        <Link href="/login" className="inline-flex items-center text-sm font-semibold text-primary hover:text-indigo-700 transition-colors">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to login
        </Link>
        <div className="text-center">
          <div className="flex justify-center mb-6">
            <img src="/logo.png" alt="SSC Portal Logo" className="h-20 w-20 object-contain transition-transform hover:scale-105" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Reset Password</h1>
          <p className="text-muted-foreground mt-2 font-medium text-sm">Enter your email and we'll send you a password reset link.</p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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
            
            <Button type="submit" className="w-full py-6 rounded-xl font-bold shadow-md hover:shadow-lg transition-all" disabled={mutation.isPending}>
              {mutation.isPending ? 'Sending...' : 'Send reset link'}
            </Button>
          </form>
        </Form>
      </div>
    </div>
  );
}
