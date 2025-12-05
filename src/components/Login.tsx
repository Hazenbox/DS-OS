import React, { useState } from 'react';
import { useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Mail, Lock, Loader2, AlertCircle, Layers } from 'lucide-react';

interface LoginProps {
  onLoginSuccess: (user: { userId: string; email: string; name?: string; role: string }) => void;
  onSwitchToSignup: () => void;
}

export const Login: React.FC<LoginProps> = ({ onLoginSuccess, onSwitchToSignup }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const login = useMutation(api.auth.login);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const result = await login({
        email: email.trim(),
        password,
      });

      // Store user in localStorage
      localStorage.setItem('user', JSON.stringify({
        userId: result.userId,
        email: result.email,
        name: result.name,
        role: result.role,
      }));

      onLoginSuccess(result);
    } catch (err: any) {
      setError(err.message || 'Failed to login. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-screen w-full items-center justify-center p-4" style={{ backgroundColor: 'var(--color-background)' }}>
      {/* Background pattern */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-20 w-96 h-96 bg-accent/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-accent/5 rounded-full blur-3xl" />
      </div>
      
      <div className="w-full max-w-md relative z-10">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-10 h-10 rounded-lg bg-accent/20 flex items-center justify-center">
            <Layers size={24} className="text-accent" />
          </div>
          <span className="text-xl font-semibold" style={{ color: 'var(--color-primary)' }}>DS-OS</span>
        </div>

        <div className="rounded-xl shadow-2xl p-8 border" style={{ 
          backgroundColor: 'var(--color-surface)',
          borderColor: 'var(--color-border)'
        }}>
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--color-primary)' }}>Welcome Back</h1>
            <p className="text-sm" style={{ color: 'var(--color-muted)' }}>Sign in to your DS-OS account</p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2 text-sm text-red-500">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-2" style={{ color: 'var(--color-primary)' }}>
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2" size={18} style={{ color: 'var(--color-muted)' }} />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/50 transition-all"
                  style={{
                    backgroundColor: 'var(--color-background)',
                    borderWidth: '1px',
                    borderStyle: 'solid',
                    borderColor: 'var(--color-border)',
                    color: 'var(--color-primary)'
                  }}
                  placeholder="you@example.com"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium mb-2" style={{ color: 'var(--color-primary)' }}>
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2" size={18} style={{ color: 'var(--color-muted)' }} />
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/50 transition-all"
                  style={{
                    backgroundColor: 'var(--color-background)',
                    borderWidth: '1px',
                    borderStyle: 'solid',
                    borderColor: 'var(--color-border)',
                    color: 'var(--color-primary)'
                  }}
                  placeholder="Enter your password"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 bg-accent text-white rounded-lg font-medium hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all hover:shadow-lg hover:shadow-accent/25"
            >
              {isLoading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm" style={{ color: 'var(--color-muted)' }}>
              Don't have an account?{' '}
              <button
                onClick={onSwitchToSignup}
                className="text-accent hover:underline font-medium"
              >
                Sign up
              </button>
            </p>
          </div>
        </div>

        <p className="text-center text-xs mt-6" style={{ color: 'var(--color-muted)' }}>
          Design System Orchestrator
        </p>
      </div>
    </div>
  );
};
