'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const isPublicPath = pathname === '/login' || pathname === '/signup';

  useEffect(() => {
    if (!isLoading && !user && !isPublicPath) {
      router.replace('/login');
    }
  }, [isLoading, user, isPublicPath, router]);

  // While auth is being resolved, show a centered spinner
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-primary" />
      </div>
    );
  }

  // On public pages, always render children (avoids redirect loop)
  if (isPublicPath) {
    return <>{children}</>;
  }

  // Not yet redirected but no user - render nothing to avoid flash
  if (!user) {
    return null;
  }

  return <>{children}</>;
}
