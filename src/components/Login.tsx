import React, { useState } from 'react';
import { useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Loader2, AlertCircle, Eye, EyeOff, Github, Layers, Sparkles, Palette, Zap } from 'lucide-react';

interface LoginProps {
  onLoginSuccess: (user: { userId: string; email: string; name?: string; role: string }) => void;
  onSwitchToSignup: () => void;
}

export const Login: React.FC<LoginProps> = ({ onLoginSuccess, onSwitchToSignup }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
    <div className="flex h-screen w-full bg-[#fafafa] dark:bg-[#0a0a0a]">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden p-8 flex-col justify-center bg-[#f0f0f0] dark:bg-[#0f0f0f]">
        {/* Gradient glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[400px] rounded-full blur-[120px] opacity-30 dark:opacity-40 bg-gradient-to-b from-violet-500 to-transparent" />
        
        {/* Logo */}
        <div className="absolute top-8 left-8 z-10 flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-violet-500/20 dark:bg-violet-500/30 flex items-center justify-center">
            <Layers size={18} className="text-violet-600 dark:text-violet-400" />
          </div>
          <span className="text-lg font-semibold text-zinc-900 dark:text-white">DS-OS</span>
        </div>

        {/* Main Content */}
        <div className="relative z-10 max-w-md mx-auto">
          <h1 className="text-4xl font-bold text-zinc-900 dark:text-white mb-4 leading-tight">
            Design Systems,<br />
            <span className="text-violet-600 dark:text-violet-400">Orchestrated.</span>
          </h1>
          <p className="text-zinc-600 dark:text-[#888] text-sm leading-relaxed mb-8">
            The unified platform for managing tokens, generating components from Figma, 
            and shipping design systems at scale.
          </p>

          {/* Features */}
          <div className="space-y-3">
            {[
              { icon: Palette, label: 'Design Tokens', desc: 'Centralized token management' },
              { icon: Sparkles, label: 'AI Generation', desc: 'Components from prompts' },
              { icon: Zap, label: 'Figma Sync', desc: 'Import directly from designs' },
            ].map((feature, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-white/50 dark:bg-white/5 border border-zinc-200 dark:border-white/10">
                <div className="w-8 h-8 rounded-md bg-violet-500/10 flex items-center justify-center">
                  <feature.icon size={16} className="text-violet-600 dark:text-violet-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-zinc-900 dark:text-white">{feature.label}</p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-500">{feature.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Panel - Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 bg-white dark:bg-[#0a0a0a]">
        <div className="w-full max-w-sm">
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center justify-center gap-2 mb-8">
            <div className="w-10 h-10 rounded-lg bg-violet-500/20 flex items-center justify-center">
              <Layers size={22} className="text-violet-600 dark:text-violet-400" />
            </div>
            <span className="text-xl font-semibold text-zinc-900 dark:text-white">DS-OS</span>
          </div>

          <div className="mb-6">
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-1">Welcome back</h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-500">Enter your credentials to continue.</p>
          </div>

          {/* OAuth Buttons */}
          <div className="flex gap-3 mb-4">
            <button className="flex-1 h-8 flex items-center justify-center gap-2 rounded-md border border-zinc-200 dark:border-white/15 text-xs font-medium text-zinc-700 dark:text-white transition-colors hover:bg-zinc-50 dark:hover:bg-white/5">
              <svg width="14" height="14" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Google
            </button>
            <button className="flex-1 h-8 flex items-center justify-center gap-2 rounded-md border border-zinc-200 dark:border-white/15 text-xs font-medium text-zinc-700 dark:text-white transition-colors hover:bg-zinc-50 dark:hover:bg-white/5">
              <Github size={14} />
              Github
            </button>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-px bg-zinc-200 dark:bg-white/10" />
            <span className="text-xs text-zinc-400 dark:text-zinc-600">Or</span>
            <div className="flex-1 h-px bg-zinc-200 dark:bg-white/10" />
          </div>

          {error && (
            <div className="mb-3 p-2 rounded-md flex items-center gap-2 text-xs bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400">
              <AlertCircle size={14} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-white/80 mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full h-8 px-3 rounded-md text-xs bg-zinc-50 dark:bg-white/5 border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500/50 transition-all"
                placeholder="you@company.com"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-white/80 mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full h-8 px-3 pr-9 rounded-md text-xs bg-zinc-50 dark:bg-white/5 border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500/50 transition-all"
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-600 hover:text-zinc-600 dark:hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-8 rounded-md text-xs font-medium bg-violet-600 hover:bg-violet-700 text-white transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-sm hover:shadow-md"
            >
              {isLoading ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          <p className="mt-4 text-center text-xs text-zinc-500 dark:text-zinc-500">
            Don't have an account?{' '}
            <button onClick={onSwitchToSignup} className="text-violet-600 dark:text-violet-400 hover:underline font-medium">
              Sign up
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};
