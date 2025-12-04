import React, { useState, useEffect } from 'react';
import { useMutation } from 'convex/react';
import { api } from '../convex/_generated/api';
import { Mail, CheckCircle, Loader2, AlertCircle, RefreshCw } from 'lucide-react';

interface EmailVerificationProps {
  verificationToken: string;
  email: string;
  onVerificationSuccess: () => void;
  onResendVerification: (token: string) => void;
}

export const EmailVerification: React.FC<EmailVerificationProps> = ({
  verificationToken: initialToken,
  email,
  onVerificationSuccess,
  onResendVerification,
}) => {
  const [verificationToken, setVerificationToken] = useState(initialToken);
  const [tokenInput, setTokenInput] = useState(initialToken);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);

  const verifyEmail = useMutation(api.auth.verifyEmail);
  const resendVerification = useMutation(api.auth.resendVerification);

  useEffect(() => {
    // Auto-verify if token is provided
    if (initialToken) {
      handleVerify(initialToken);
    }
  }, []);

  const handleVerify = async (token: string) => {
    setError('');
    setIsLoading(true);

    try {
      await verifyEmail({ token });
      setSuccess(true);
      setTimeout(() => {
        onVerificationSuccess();
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to verify email. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    setError('');
    setIsResending(true);

    try {
      const result = await resendVerification({ email });
      setVerificationToken(result.verificationToken);
      setTokenInput(result.verificationToken);
      onResendVerification(result.verificationToken);
      setSuccess(false);
    } catch (err: any) {
      setError(err.message || 'Failed to resend verification email.');
    } finally {
      setIsResending(false);
    }
  };

  if (success) {
    return (
      <div className="flex h-screen w-full bg-[#fafafa] dark:bg-[#000000] items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-background border border-border rounded-lg shadow-lg p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="text-green-500" size={32} />
            </div>
            <h1 className="text-2xl font-bold text-primary mb-2">Email Verified!</h1>
            <p className="text-sm text-muted mb-6">
              Your email has been successfully verified. Redirecting...
            </p>
            <Loader2 className="w-6 h-6 animate-spin text-accent mx-auto" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full bg-[#fafafa] dark:bg-[#000000] items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-background border border-border rounded-lg shadow-lg p-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-full bg-blue-500/10 flex items-center justify-center mx-auto mb-4">
              <Mail className="text-blue-500" size={32} />
            </div>
            <h1 className="text-2xl font-bold text-primary mb-2">Verify Your Email</h1>
            <p className="text-sm text-muted">
              We've sent a verification link to <strong>{email}</strong>
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label htmlFor="token" className="block text-sm font-medium text-primary mb-2">
                Verification Token
              </label>
              <input
                id="token"
                type="text"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                className="w-full px-4 py-2.5 bg-background border border-border rounded-lg text-primary placeholder:text-muted focus:outline-none focus:border-accent font-mono text-sm"
                placeholder="Enter verification token"
              />
              <p className="mt-2 text-xs text-muted">
                Check your email for the verification token, or use the token shown in the console.
              </p>
            </div>

            <button
              onClick={() => handleVerify(tokenInput)}
              disabled={isLoading || !tokenInput}
              className="w-full py-2.5 bg-accent text-white rounded-lg font-medium hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
            >
              {isLoading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Verifying...
                </>
              ) : (
                'Verify Email'
              )}
            </button>

            <div className="pt-4 border-t border-border">
              <p className="text-sm text-muted text-center mb-3">
                Didn't receive the email?
              </p>
              <button
                onClick={handleResend}
                disabled={isResending}
                className="w-full py-2 text-sm text-accent hover:underline disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isResending ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <RefreshCw size={14} />
                    Resend Verification Email
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
            <p className="text-xs text-blue-600 dark:text-blue-400">
              <strong>Development Note:</strong> In development mode, the verification token is logged to the console. 
              In production, this would be sent via email.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

