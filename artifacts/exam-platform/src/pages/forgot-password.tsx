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
          description: err.error || 'Something went wrong',
          variant: 'destructive',
        });
      }
    });
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8 bg-background">
      <div className="w-full max-w-md space-y-8">
        <Link href="/login" className="flex items-center text-sm font-medium text-muted-foreground hover:text-foreground">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to login
        </Link>
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <div className="h-12 w-12 bg-primary/10 text-primary rounded-xl flex items-center justify-center">
              <ShieldCheck className="h-8 w-8" />
            </div>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Reset Password</h1>
          <p className="text-muted-foreground mt-2">Enter your email and we'll send you a reset link.</p>
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
            
            <Button type="submit" className="w-full" disabled={mutation.isPending}>
              {mutation.isPending ? 'Sending...' : 'Send reset link'}
            </Button>
          </form>
        </Form>
      </div>
    </div>
  );
}
