import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, setAuthTokenGetter, customFetch } from '@workspace/api-client-react';

// Configure the API client to attach the auth token to every request
setAuthTokenGetter(() => localStorage.getItem('token'));

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
    // Always fetch /auth/me on bootstrap to check active session cookie
    customFetch('/api/v1/auth/me', { method: 'GET' })
      .then((freshUser: any) => {
        setToken("authenticated");
        setUser(freshUser as User);
      })
      .catch(() => {
        // Not logged in or network error
        setToken(null);
        setUser(null);
      })
      .finally(() => setIsLoading(false));
  }, []);

  const login = (newToken: string, newUser: User) => {
    setToken(newToken || "authenticated");
    setUser(newUser);
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    customFetch('/api/v1/auth/logout', { method: 'POST' }).catch(() => {});
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
