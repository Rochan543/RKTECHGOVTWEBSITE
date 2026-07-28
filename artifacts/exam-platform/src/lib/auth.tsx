import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, setAuthTokenGetter, customFetch } from '@workspace/api-client-react';

// Configure the API client to attach the auth token to every request
setAuthTokenGetter(() => sessionStorage.getItem('token'));

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedToken = sessionStorage.getItem('token');
    if (!storedToken) {
      setIsLoading(false);
      return;
    }

    // Always fetch /auth/me on bootstrap so the role reflected in the UI
    // is the current DB role — not a stale sessionStorage snapshot.
    (customFetch('/api/v1/auth/me', { method: 'GET' }) as Promise<Response>)
      .then(async (res) => {
        if (!res.ok) {
          // Token is invalid or user suspended — clear session
          sessionStorage.removeItem('token');
          sessionStorage.removeItem('user');
          return;
        }
        const freshUser: User = await res.json();
        setToken(storedToken);
        setUser(freshUser);
        // Keep sessionStorage in sync so next cold-start has a warm snapshot
        sessionStorage.setItem('user', JSON.stringify(freshUser));
      })
      .catch(() => {
        // Network error — fall back to cached user so offline-ish loads still work
        const storedUser = sessionStorage.getItem('user');
        if (storedUser) {
          try {
            setToken(storedToken);
            setUser(JSON.parse(storedUser));
          } catch { /* corrupt cache — leave logged out */ }
        }
      })
      .finally(() => setIsLoading(false));
  }, []);

  const login = (newToken: string, newUser: User) => {
    setToken(newToken);
    setUser(newUser);
    sessionStorage.setItem('token', newToken);
    sessionStorage.setItem('user', JSON.stringify(newUser));
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
