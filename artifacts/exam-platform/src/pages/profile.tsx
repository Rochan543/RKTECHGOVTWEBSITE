import React, { useState, useRef } from 'react';
import { useGetCurrentUser, getGetCurrentUserQueryKey, useUpdateUser, customFetch } from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { User as UserIcon, Mail, Phone, Calendar, Edit3, Loader2, Camera, Trash2, Save, X } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { optimizeCloudinaryUrl } from '@/lib/utils';

export default function Profile() {
  const auth = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: user, isLoading } = useGetCurrentUser({
    query: { enabled: !!auth.user, queryKey: getGetCurrentUserQueryKey() }
  });

  // Edit States
  const [showDialog, setShowDialog] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editAvatarUrl, setEditAvatarUrl] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const updateUserMutation = useUpdateUser();

  if (isLoading || !user) {
    return (
      <div className="max-w-3xl mx-auto p-8 animate-pulse space-y-6">
        <div className="h-32 bg-muted rounded-xl"></div>
        <div className="h-64 bg-muted rounded-xl"></div>
      </div>
    );
  }

  const openEditDialog = () => {
    setEditName(user.name || '');
    setEditPhone(user.phone || '');
    setEditAvatarUrl(user.avatarUrl || '');
    setShowDialog(true);
  };

  const handleAvatarUpload = (file: File) => {
    setIsUploading(true);
    setUploadProgress(0);
    try {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const raw = reader.result as string;
          const base64Content = raw.split(',')[1] || raw;

          const xhr = new XMLHttpRequest();
          xhr.open('POST', '/api/v1/upload');
          xhr.setRequestHeader('Content-Type', 'application/json');
          xhr.withCredentials = true;

          xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
              const percent = Math.round((event.loaded / event.total) * 100);
              setUploadProgress(Math.min(95, percent));
            }
          };

          xhr.onload = () => {
            try {
              if (xhr.status >= 200 && xhr.status < 300) {
                const uploadRes = JSON.parse(xhr.responseText);
                setUploadProgress(100);
                setEditAvatarUrl(uploadRes.fileUrl);
                toast({ title: 'Avatar uploaded successfully' });
              } else {
                let errorMsg = 'Upload failed';
                try {
                  const parsed = JSON.parse(xhr.responseText);
                  errorMsg = parsed.error || errorMsg;
                } catch {
                  errorMsg = `Server error: ${xhr.status}`;
                }
                throw new Error(errorMsg);
              }
            } catch (err: any) {
              const msg = err.message || String(err);
              toast({ title: 'Upload failed', description: msg, variant: 'destructive' });
            } finally {
              setIsUploading(false);
              setUploadProgress(0);
            }
          };

          xhr.onerror = () => {
            toast({ title: 'Upload failed', description: 'Network error during upload.', variant: 'destructive' });
            setIsUploading(false);
            setUploadProgress(0);
          };

          xhr.send(JSON.stringify({
            fileName: file.name,
            mimeType: file.type || 'application/octet-stream',
            fileData: base64Content,
          }));
        } catch (err: any) {
          const msg = err.message || String(err);
          toast({ title: 'Upload failed', description: msg, variant: 'destructive' });
          setIsUploading(false);
          setUploadProgress(0);
        }
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      const msg = err.message || String(err);
      toast({ title: 'Upload failed', description: msg, variant: 'destructive' });
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleRemoveAvatar = () => {
    setEditAvatarUrl('');
    toast({ title: 'Avatar removed from edit session' });
  };

  const handleSave = () => {
    if (!editName.trim()) {
      toast({ title: 'Name is required', variant: 'destructive' });
      return;
    }

    updateUserMutation.mutate(
      {
        id: user.id,
        data: {
          name: editName,
          phone: editPhone || null,
          avatarUrl: editAvatarUrl || null,
        },
      },
      {
        onSuccess: (updatedUser) => {
          // Immediately update context state
          auth.setUser(updatedUser);
          // Invalidate React Query cache
          queryClient.invalidateQueries({ queryKey: getGetCurrentUserQueryKey() });
          queryClient.invalidateQueries({ queryKey: ['/api/v1/users'] });
          toast({ title: 'Profile updated successfully' });
          setShowDialog(false);
        },
        onError: (err: any) => {
          const msg = err.message || 'Failed to update profile';
          toast({ title: 'Error', description: msg, variant: 'destructive' });
        },
      }
    );
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-500">
      <h1 className="text-3xl font-bold tracking-tight">My Profile</h1>
      
      <Card className="overflow-hidden border-0 shadow-lg">
        <div className="h-32 bg-gradient-to-r from-indigo-500 via-primary to-indigo-600 relative">
          <div className="absolute -bottom-12 left-8">
            <Avatar className="h-24 w-24 border-4 border-background shadow-md">
              <AvatarImage src={optimizeCloudinaryUrl(user.avatarUrl, { width: 150, height: 150 })} />
              <AvatarFallback className="text-3xl bg-secondary text-secondary-foreground font-bold">
                {user.name.substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </div>
        </div>
        <CardContent className="pt-16 pb-8 px-8">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold">{user.name}</h2>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className="capitalize">{user.role.replace('_', ' ')}</Badge>
                <Badge variant={user.status === 'active' ? 'default' : 'destructive'} className="capitalize bg-green-500 hover:bg-green-600 text-white">
                  {user.status}
                </Badge>
              </div>
            </div>
            <Button variant="outline" className="gap-2" onClick={openEditDialog}>
              <Edit3 className="h-4 w-4" /> Edit Profile
            </Button>
          </div>

          <Separator className="my-8" />

          <div className="grid md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-4">Contact Information</h3>
                <div className="space-y-4">
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <Mail className="h-5 w-5 text-primary/70" />
                    <span className="text-foreground">{user.email}</span>
                  </div>
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <Phone className="h-5 w-5 text-primary/70" />
                    <span className="text-foreground">{user.phone || 'Not provided'}</span>
                  </div>
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <Calendar className="h-5 w-5 text-primary/70" />
                    <span className="text-foreground">Joined {new Date(user.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-4">Platform Stats</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-muted/30 p-4 rounded-xl border">
                    <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-1">Total Score</p>
                    <p className="text-3xl font-bold text-primary">{user.totalScore?.toLocaleString() || 0}</p>
                  </div>
                  <div className="bg-muted/30 p-4 rounded-xl border">
                    <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-1">Current Rank</p>
                    <p className="text-3xl font-bold">{user.rank ? `#${user.rank}` : '-'}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Edit Profile Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Edit Profile</DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-4">
            {/* Avatar Edit Area */}
            <div className="flex flex-col items-center gap-3">
              <div className="relative group">
                <Avatar className="h-24 w-24 border-2 border-primary/20">
                  <AvatarImage src={optimizeCloudinaryUrl(editAvatarUrl, { width: 150, height: 150 })} />
                  <AvatarFallback className="text-3xl bg-secondary text-secondary-foreground font-bold">
                    {editName.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                {isUploading && (
                  <div className="absolute inset-0 bg-background/80 rounded-full flex flex-col items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    <span className="text-[10px] font-semibold mt-1">{uploadProgress}%</span>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleAvatarUpload(file);
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                >
                  <Camera className="h-3.5 w-3.5" /> Upload Image
                </Button>
                {editAvatarUrl && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:bg-destructive/10 gap-1.5"
                    onClick={handleRemoveAvatar}
                    disabled={isUploading}
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Remove
                  </Button>
                )}
              </div>
            </div>

            {/* Form Fields */}
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Full Name *</label>
                <Input
                  placeholder="Enter full name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Phone Number</label>
                <Input
                  placeholder="Enter phone number"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                />
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowDialog(false)} disabled={isUploading}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={updateUserMutation.isPending || isUploading}
              className="gap-1.5"
            >
              {updateUserMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
