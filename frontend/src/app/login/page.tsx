'use client';

import { useState } from 'react';
import { FileText, Loader2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import AnimatedAuthShell from '@/components/auth/AnimatedAuthShell';

export default function LoginPage() {
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;

    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      await login(email.trim(), password);
      // login() handles the redirect on success
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 401) {
        setErrorMsg('Invalid email or password.');
      } else {
        setErrorMsg('Unable to sign in. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatedAuthShell>
      {/* Logo */}
      <div className="flex flex-col items-center gap-3 px-8 pb-6 pt-8">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-[#2dd4bf] to-[#14b8a6]/70 text-[#052e2b] shadow-md">
          <FileText size={20} />
        </div>
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Resu<span className="text-[#2dd4bf]">Mate</span>
          </h1>
          <p className="mt-1 text-sm text-[#8a9199]">Sign in to continue</p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} noValidate>
        <div className="space-y-4 px-8">
          {/* Error message */}
          {errorMsg && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-sm text-red-400">
              {errorMsg}
            </div>
          )}

          {/* Email */}
          <div className="space-y-1.5">
            <label
              htmlFor="email"
              className="text-xs font-medium uppercase tracking-wide text-[#8a9199]"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (errorMsg) setErrorMsg(null);
              }}
              disabled={isSubmitting}
              placeholder="you@example.com"
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-white/40 focus:border-[#2dd4bf]/50 focus:outline-none focus:ring-2 focus:ring-[#2dd4bf]/40 disabled:opacity-50 transition-colors"
            />
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <label
              htmlFor="password"
              className="text-xs font-medium uppercase tracking-wide text-[#8a9199]"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (errorMsg) setErrorMsg(null);
              }}
              disabled={isSubmitting}
              placeholder="Your password"
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-white/40 focus:border-[#2dd4bf]/50 focus:outline-none focus:ring-2 focus:ring-[#2dd4bf]/40 disabled:opacity-50 transition-colors"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 border-t border-white/10 px-8 pb-6 pt-4">
          <button
            type="submit"
            disabled={isSubmitting || !email.trim() || !password}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#2dd4bf] px-4 py-2.5 text-sm font-semibold text-[#052e2b] shadow-sm transition-colors hover:bg-[#14b8a6] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                Signing in...
              </>
            ) : (
              'Sign in'
            )}
          </button>
        </div>
      </form>

      {/* Sign up */}
      <p className="pb-8 text-center text-sm text-[#8a9199]">
        Have an access code?{' '}
        <a href="/signup" className="font-medium text-[#2dd4bf] hover:underline">
          Sign up
        </a>
      </p>
    </AnimatedAuthShell>
  );
}
