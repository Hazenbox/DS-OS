import React, { useState } from 'react';
import { useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Mail, Lock, Loader2, AlertCircle, Eye, EyeOff, Github } from 'lucide-react';

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
    <div className="flex h-screen w-full" style={{ backgroundColor: '#0a0a0a' }}>
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden p-8 flex-col justify-between" style={{ backgroundColor: '#0f0f0f' }}>
        {/* Gradient glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[400px] rounded-full blur-[120px] opacity-40" 
          style={{ background: 'radial-gradient(circle, #10b981 0%, transparent 70%)' }} 
        />
        
        {/* Content */}
        <div className="relative z-10 flex-1 flex flex-col justify-center max-w-md mx-auto">
          <h1 className="text-4xl font-bold text-white mb-4">Welcome Back</h1>
          <p className="text-[#888] text-sm leading-relaxed">
            Sign in to continue managing your design system and components.
          </p>
        </div>

        {/* Steps */}
        <div className="relative z-10 flex gap-4">
          {[
            { num: 1, label: 'Sign in to your account', active: true },
            { num: 2, label: 'Access your workspace', active: false },
            { num: 3, label: 'Manage components', active: false },
          ].map((step) => (
            <div 
              key={step.num}
              className="flex-1 p-3 rounded-lg border text-center"
              style={{ 
                backgroundColor: step.active ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
                borderColor: step.active ? 'rgba(16, 185, 129, 0.3)' : 'rgba(255,255,255,0.1)'
              }}
            >
              <div 
                className="w-6 h-6 rounded-full mx-auto mb-2 flex items-center justify-center text-xs font-medium"
                style={{ 
                  backgroundColor: step.active ? '#10b981' : 'rgba(255,255,255,0.1)',
                  color: step.active ? '#000' : '#666'
                }}
              >
                {step.num}
              </div>
              <p className="text-xs" style={{ color: step.active ? '#fff' : '#666' }}>{step.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Right Panel - Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6" style={{ backgroundColor: '#0a0a0a' }}>
        <div className="w-full max-w-sm">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-white mb-1">Sign In</h2>
            <p className="text-xs" style={{ color: '#666' }}>Enter your credentials to access your account.</p>
          </div>

          {/* OAuth Buttons */}
          <div className="flex gap-3 mb-4">
            <button className="flex-1 h-8 flex items-center justify-center gap-2 rounded-md border text-xs font-medium transition-colors hover:bg-white/5"
              style={{ borderColor: 'rgba(255,255,255,0.15)', color: '#fff' }}>
              <svg width="14" height="14" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Google
            </button>
            <button className="flex-1 h-8 flex items-center justify-center gap-2 rounded-md border text-xs font-medium transition-colors hover:bg-white/5"
              style={{ borderColor: 'rgba(255,255,255,0.15)', color: '#fff' }}>
              <Github size={14} />
              Github
            </button>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-px" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }} />
            <span className="text-xs" style={{ color: '#666' }}>Or</span>
            <div className="flex-1 h-px" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }} />
          </div>

          {error && (
            <div className="mb-3 p-2 rounded-md flex items-center gap-2 text-xs" 
              style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#ef4444' }}>
              <AlertCircle size={14} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-white/80 mb-1.5">Email</label>
              <div className="relative">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full h-8 px-3 rounded-md text-xs text-white placeholder:text-[#555] focus:outline-none focus:ring-1 focus:ring-emerald-500/50 transition-all"
                  style={{ backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                  placeholder="eg. johnfrans@gmail.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-white/80 mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full h-8 px-3 pr-9 rounded-md text-xs text-white placeholder:text-[#555] focus:outline-none focus:ring-1 focus:ring-emerald-500/50 transition-all"
                  style={{ backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#555] hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-8 rounded-md text-xs font-medium transition-all flex items-center justify-center gap-2 hover:bg-white hover:text-black disabled:opacity-50"
              style={{ border: '1px solid rgba(255,255,255,0.2)', color: '#fff' }}
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

          <p className="mt-4 text-center text-xs" style={{ color: '#666' }}>
            Don't have an account?{' '}
            <button onClick={onSwitchToSignup} className="text-white hover:underline font-medium">
              Sign up
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};
