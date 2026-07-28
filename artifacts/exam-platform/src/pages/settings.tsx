import { useMutation, useQueryClient } from '@tanstack/react-query';
import { customFetch } from '@workspace/api-client-react';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';
import { User, Lock, Save, Loader2 } from 'lucide-react';

export default function Settings() {
  const { user, login, token } = useAuth();
  const { toast } = useToast();

  const [name, setName] = useState(user?.name ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');

  const updateProfile = useMutation({
    mutationFn: (data: { name?: string; phone?: string | null }) =>
      customFetch<{ id: number; name: string; email: string; role: string; phone: string | null }>(
        '/api/v1/settings/profile',
        { method: 'PATCH', body: JSON.stringify(data) },
      ),
    onSuccess: (updated) => {
      if (user && token) {
        login(token, { ...user, name: updated.name, phone: updated.phone });
      }
      toast({ title: 'Profile updated successfully' });
    },
    onError: () => toast({ title: 'Update failed', variant: 'destructive' }),
  });

  const changePassword = useMutation({
    mutationFn: (data: { currentPassword: string; newPassword: string }) =>
      customFetch('/api/v1/settings/change-password', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      toast({ title: 'Password changed successfully' });
      setCurrentPw('');
      setNewPw('');
      setConfirmPw('');
    },
    onError: (err: { data?: { error?: string } }) =>
      toast({ title: (err.data as { error?: string })?.error ?? 'Failed to change password', variant: 'destructive' }),
  });

  const handleProfileSave = () => {
    if (!name.trim()) {
      toast({ title: 'Name cannot be empty', variant: 'destructive' });
      return;
    }
    updateProfile.mutate({ name: name.trim(), phone: phone.trim() || null });
  };

  const handlePasswordChange = () => {
    if (!currentPw || !newPw || !confirmPw) {
      toast({ title: 'Please fill all password fields', variant: 'destructive' });
      return;
    }
    if (newPw !== confirmPw) {
      toast({ title: 'New passwords do not match', variant: 'destructive' });
      return;
    }
    if (newPw.length < 8) {
      toast({ title: 'New password must be at least 8 characters', variant: 'destructive' });
      return;
    }
    changePassword.mutate({ currentPassword: currentPw, newPassword: newPw });
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your account preferences</p>
      </div>

      {/* Profile */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" /> Profile Information
          </CardTitle>
          <CardDescription>Update your display name and contact details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Full Name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your full name" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <Input id="email" value={user?.email ?? ''} disabled className="bg-muted/50" />
            <p className="text-xs text-muted-foreground">Email cannot be changed</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number</Label>
            <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 9876543210" />
          </div>
          <Button onClick={handleProfileSave} disabled={updateProfile.isPending} className="w-full">
            {updateProfile.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Save Profile
          </Button>
        </CardContent>
      </Card>

      {/* Password */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" /> Change Password
          </CardTitle>
          <CardDescription>Keep your account secure with a strong password</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="current-pw">Current Password</Label>
            <Input id="current-pw" type="password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} placeholder="Enter current password" />
          </div>
          <Separator />
          <div className="space-y-2">
            <Label htmlFor="new-pw">New Password</Label>
            <Input id="new-pw" type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder="At least 8 characters" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-pw">Confirm New Password</Label>
            <Input id="confirm-pw" type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} placeholder="Re-enter new password" />
          </div>
          <Button onClick={handlePasswordChange} disabled={changePassword.isPending} variant="outline" className="w-full">
            {changePassword.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Lock className="h-4 w-4 mr-2" />}
            Update Password
          </Button>
        </CardContent>
      </Card>

      {/* Account Info */}
      <Card>
        <CardHeader>
          <CardTitle>Account Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { label: 'Role', value: user?.role ?? '—' },
            { label: 'Status', value: user?.status ?? '—' },
            { label: 'Rank', value: user?.rank ? `#${user.rank}` : 'Not ranked yet' },
            { label: 'Total Score', value: user?.totalScore ? user.totalScore.toFixed(0) : '0' },
          ].map((item) => (
            <div key={item.label} className="flex justify-between text-sm py-2 border-b last:border-0">
              <span className="text-muted-foreground">{item.label}</span>
              <span className="font-medium capitalize">{item.value}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
