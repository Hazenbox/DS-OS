# Authentication System

## Overview

The application now includes a complete email-based authentication system with email verification. Users must sign up, verify their email, and log in to access the application.

## Features

✅ **User Signup** - Create new accounts with email and password
✅ **Email Verification** - Verify email addresses with tokens
✅ **User Login** - Secure login with email and password
✅ **Protected Routes** - All app features require authentication
✅ **User Profile** - Display user info in sidebar
✅ **Logout** - Sign out functionality

## Implementation Details

### Backend (Convex)

**Schema Updates** (`convex/schema.ts`):
- Added `users` table with email, name, role, and verification status
- Added `emailVerifications` table for managing verification tokens

**Auth Functions** (`convex/auth.ts`):
- `signup` - Create new user account
- `verifyEmail` - Verify email with token
- `login` - Authenticate user
- `getCurrentUser` - Get user information
- `resendVerification` - Resend verification email

### Frontend Components

**Login Component** (`components/Login.tsx`):
- Email and password login form
- Error handling
- Link to signup

**Signup Component** (`components/Signup.tsx`):
- User registration form
- Password confirmation
- Email validation
- Link to login

**Email Verification Component** (`components/EmailVerification.tsx`):
- Token input for verification
- Resend verification email
- Success confirmation

### App Integration

**App.tsx**:
- Authentication state management
- Protected route handling
- User session persistence (localStorage)

**Sidebar**:
- Display authenticated user info
- Logout button

## Usage Flow

1. **First Visit**: User sees login screen
2. **Sign Up**: Click "Sign up" → Fill form → Account created
3. **Email Verification**: 
   - Verification token is generated
   - In development: Token is logged to console
   - In production: Token would be sent via email
   - User enters token to verify
4. **Login**: After verification, user can log in
5. **Access**: Once logged in, user has full access to the app
6. **Logout**: Click logout in sidebar to sign out

## Development Notes

### Current Implementation

- **Password Storage**: Currently passwords are stored in plain text (NOT SECURE)
- **Email Sending**: Verification tokens are logged to console instead of sent via email
- **Session Management**: User session is stored in localStorage

### Production Recommendations

1. **Password Hashing**: Implement proper password hashing (bcrypt, argon2)
2. **Email Service**: Integrate email service (SendGrid, Resend, etc.) for verification emails
3. **Session Tokens**: Use JWT or Convex's built-in auth tokens
4. **Password Reset**: Add password reset functionality
5. **Two-Factor Auth**: Consider adding 2FA for enhanced security

## Environment Variables

No additional environment variables are required for basic authentication. For production email sending, you would need:

```env
EMAIL_SERVICE_API_KEY=your_api_key
EMAIL_FROM=noreply@yourdomain.com
```

## Testing

1. **Sign Up**:
   - Go to signup page
   - Enter email, password, and name
   - Check console for verification token

2. **Verify Email**:
   - Copy token from console
   - Paste in verification screen
   - Click "Verify Email"

3. **Login**:
   - Use your email and password
   - Should redirect to dashboard

4. **Logout**:
   - Click logout in sidebar
   - Should return to login screen

## Security Considerations

⚠️ **Important**: This is a development implementation. For production:

1. Never store passwords in plain text
2. Use HTTPS for all authentication
3. Implement rate limiting on login/signup
4. Add CSRF protection
5. Use secure session management
6. Implement password strength requirements
7. Add account lockout after failed attempts
8. Log security events

## Future Enhancements

- [ ] Password reset functionality
- [ ] Remember me option
- [ ] Social login (Google, GitHub)
- [ ] Two-factor authentication
- [ ] Account management page
- [ ] Email change functionality
- [ ] Password change functionality
- [ ] Session management (view active sessions)

