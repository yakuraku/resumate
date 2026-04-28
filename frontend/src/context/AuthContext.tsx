'use client';

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/axios';
import { setCsrfToken, clearCsrfToken } from '@/lib/csrf';

export interface AuthUser {
  id: string;
  email: string;
  is_admin: boolean;
  is_active: boolean;
  created_at: string;
}

interface LoginResponse {
  user: AuthUser;
  csrf_token: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, accessCode: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    try {
      const res = await apiClient.get<AuthUser>('/auth/me');
      setUser(res.data);
    } catch {
      // 401 or network error - user is not authenticated
      setUser(null);
    }
  }, []);

  useEffect(() => {
    checkAuth().finally(() => setIsLoading(false));
  }, [checkAuth]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await apiClient.post<LoginResponse>('/auth/login', { email, password });
    setCsrfToken(res.data.csrf_token);
    setUser(res.data.user);
    router.push('/');
  }, [router]);

  const signup = useCallback(async (email: string, password: string, accessCode: string) => {
    const res = await apiClient.post<LoginResponse>('/auth/signup', {
      email,
      password,
      access_code: accessCode,
    });
    setCsrfToken(res.data.csrf_token);
    setUser(res.data.user);
    router.push('/');
  }, [router]);

  const logout = useCallback(async () => {
    try {
      // CSRF header is added automatically by the axios request interceptor
      await apiClient.post('/auth/logout');
    } catch {
      // Best-effort - clear local state regardless
    }
    clearCsrfToken();
    setUser(null);
    router.push('/login');
  }, [router]);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, signup, logout, checkAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (ctx === null) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
