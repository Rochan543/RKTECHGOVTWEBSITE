import { useGetCurrentUser, getGetCurrentUserQueryKey } from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { User as UserIcon, Mail, Phone, Calendar, Shield, MapPin, Edit3 } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

export default function Profile() {
  const { user: authUser } = useAuth();
  
  const { data: user, isLoading } = useGetCurrentUser({
    query: { enabled: !!authUser, queryKey: getGetCurrentUserQueryKey() }
  });

  if (isLoading || !user) {
    return (
      <div className="max-w-3xl mx-auto p-8 animate-pulse space-y-6">
        <div className="h-32 bg-muted rounded-xl"></div>
        <div className="h-64 bg-muted rounded-xl"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-500">
      <h1 className="text-3xl font-bold tracking-tight">My Profile</h1>
      
      <Card className="overflow-hidden border-0 shadow-lg">
        <div className="h-32 bg-gradient-to-r from-indigo-500 via-primary to-indigo-600 relative">
          <div className="absolute -bottom-12 left-8">
            <Avatar className="h-24 w-24 border-4 border-background shadow-md">
              <AvatarImage src={user.avatarUrl || ''} />
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
            <Button variant="outline" className="gap-2">
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
    </div>
  );
}
