import { useState, useRef, useEffect } from 'react';
import { Phone, Mail, Lock, ChevronDown, ArrowRight, CheckCircle2, Hand, X, ArrowLeft } from 'lucide-react';
import type { Role } from '../types';
import { Logo } from '../components/ui';

// ---------- Types ----------
interface StoredUser {
  email?: string;
  phone?: string;
  password: string;
  role: Role;
  name: string;
  provider?: 'local' | 'google' | 'facebook';
}

// ---------- Helpers ----------
const USERS_KEY = 'smartbuild_users';

function getUsers(): StoredUser[] {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveUsers(users: StoredUser[]) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// TODO: Replace localStorage with MongoDB API calls when backend is ready
// Backend: Node.js + Express + Mongoose
// Endpoints: /api/auth/login, /api/auth/register, /api/auth/verify-otp, /api/auth/forgot-password
// User schema will map to MongoDB collection "users" with fields: name, email, phone, password (hashed), role, provider (local/google/facebook)

export function AuthScreen({ onAuth, defaultRole = 'client' }: { onAuth: (role: Role) => void; defaultRole?: Role }) {
  const [role, setRole] = useState<Role>(defaultRole);
  const [method, setMethod] = useState<'phone' | 'email'>('phone');
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [language, setLanguage] = useState('EN');
  const [langOpen, setLangOpen] = useState(false);

  // Form fields
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');

  // OTP flow
  const [otpSent, setOtpSent] = useState(false);
  const [generatedOtp, setGeneratedOtp] = useState('');
  const [otpMessage, setOtpMessage] = useState('');

  // Errors
  const [generalError, setGeneralError] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [otpError, setOtpError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');
  const [nameError, setNameError] = useState('');

  // Pointing hand animation
  const [showPointingHand, setShowPointingHand] = useState(false);
  const signupLinkRef = useRef<HTMLButtonElement>(null);

  // Social login modal state
  const [showSocialModal, setShowSocialModal] = useState<null | 'google' | 'facebook'>(null);
  const [socialModalEmail, setSocialModalEmail] = useState('');
  const [socialError, setSocialError] = useState('');

  // Forgot password modal state
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotStep, setForgotStep] = useState<1 | 2 | 3>(1);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotCode, setForgotCode] = useState('');
  const [forgotCodeInput, setForgotCodeInput] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [forgotError, setForgotError] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState('');

  // Clear errors when switching modes/methods
  useEffect(() => {
    setGeneralError('');
    setPhoneError('');
    setOtpError('');
    setEmailError('');
    setPasswordError('');
    setConfirmPasswordError('');
    setNameError('');
    setShowPointingHand(false);
    setOtpSent(false);
    setOtpMessage('');
  }, [mode, method]);

  // ---------- PHONE LOGIN ----------
  const handlePhoneLogin = () => {
    setGeneralError('');
    setPhoneError('');

    if (!phone.trim()) {
      setPhoneError('Please enter your phone number');
      return;
    }
    if (phone.replace(/\D/g, '').length < 10) {
      setPhoneError('Please enter a valid 10-digit phone number');
      return;
    }

    const users = getUsers();
    const existingUser = users.find(u => u.phone === phone && u.role === role);

    if (!existingUser) {
      setGeneralError('You are a new user. Please create an account by signing up.');
      setShowPointingHand(true);
      return;
    }

    const newOtp = String(Math.floor(100000 + Math.random() * 900000));
    setGeneratedOtp(newOtp);
    setOtpSent(true);
    setOtpMessage(`OTP sent to +91 ${phone}. (Demo OTP: ${newOtp})`);
    setOtpError('');
  };

  // ---------- PHONE OTP VERIFY ----------
  const handleOtpVerify = () => {
    setOtpError('');

    if (!otp.trim()) {
      setOtpError('Please enter the OTP');
      return;
    }
    if (otp.length !== 6) {
      setOtpError('Please enter a valid 6-digit OTP');
      return;
    }

    if (otp !== generatedOtp) {
      setOtpError('Incorrect OTP. Please try again.');
      return;
    }

    onAuth(role);
  };

  // ---------- PHONE SIGNUP ----------
  const handlePhoneSignup = () => {
    setGeneralError('');
    setPhoneError('');
    setOtpError('');
    setNameError('');

    if (!name.trim()) {
      setNameError('Please enter your name');
      return;
    }
    if (!phone.trim()) {
      setPhoneError('Please enter your phone number');
      return;
    }
    if (phone.replace(/\D/g, '').length < 10) {
      setPhoneError('Please enter a valid 10-digit phone number');
      return;
    }

    const users = getUsers();
    const existing = users.find(u => u.phone === phone && u.role === role);
    if (existing) {
      setGeneralError('An account with this phone number already exists. Please log in.');
      setShowPointingHand(true);
      return;
    }

    const newOtp = String(Math.floor(100000 + Math.random() * 900000));
    setGeneratedOtp(newOtp);
    setOtpSent(true);
    setOtpMessage(`OTP sent to +91 ${phone}. (Demo OTP: ${newOtp})`);
  };

  // ---------- PHONE OTP SIGNUP VERIFY ----------
  const handleOtpSignupVerify = () => {
    setOtpError('');

    if (!otp.trim()) {
      setOtpError('Please enter the OTP');
      return;
    }
    if (otp.length !== 6) {
      setOtpError('Please enter a valid 6-digit OTP');
      return;
    }
    if (otp !== generatedOtp) {
      setOtpError('Incorrect OTP. Please try again.');
      return;
    }

    const users = getUsers();
    users.push({ phone, password: '', role, name, provider: 'local' });
    saveUsers(users);

    onAuth(role);
  };

  // ---------- EMAIL LOGIN ----------
  const handleEmailLogin = () => {
    setGeneralError('');
    setEmailError('');
    setPasswordError('');

    if (!email.trim()) {
      setEmailError('Please enter your email address');
      return;
    }
    if (!isValidEmail(email)) {
      setEmailError('Please enter a valid email address');
      return;
    }
    if (!password.trim()) {
      setPasswordError('Please enter your password');
      return;
    }

    const users = getUsers();
    const existingUser = users.find(u => u.email === email && u.role === role);

    if (!existingUser) {
      setGeneralError('No account found with this email. Please sign up first.');
      setShowPointingHand(true);
      return;
    }

    if (existingUser.password !== password) {
      setGeneralError('Incorrect email or password. Please try again.');
      return;
    }

    onAuth(role);
  };

  // ---------- EMAIL SIGNUP ----------
  const handleEmailSignup = () => {
    setGeneralError('');
    setEmailError('');
    setPasswordError('');
    setConfirmPasswordError('');
    setNameError('');

    if (!name.trim()) {
      setNameError('Please enter your name');
      return;
    }
    if (!email.trim()) {
      setEmailError('Please enter your email address');
      return;
    }
    if (!isValidEmail(email)) {
      setEmailError('Please enter a valid email address');
      return;
    }
    if (!password.trim()) {
      setPasswordError('Please enter a password');
      return;
    }
    if (password.length < 4) {
      setPasswordError('Password must be at least 4 characters');
      return;
    }
    if (!confirmPassword.trim()) {
      setConfirmPasswordError('Please confirm your password');
      return;
    }
    if (password !== confirmPassword) {
      setConfirmPasswordError('Passwords do not match');
      return;
    }

    const users = getUsers();
    const existing = users.find(u => u.email === email && u.role === role);
    if (existing) {
      setGeneralError('An account with this email already exists. Please log in.');
      setShowPointingHand(true);
      return;
    }

    users.push({ email, password, role, name, provider: 'local' });
    saveUsers(users);

    onAuth(role);
  };

  // ---------- MAIN SUBMIT ----------
  const handleSubmit = () => {
    if (method === 'phone') {
      if (mode === 'login') {
        if (!otpSent) {
          handlePhoneLogin();
        } else {
          handleOtpVerify();
        }
      } else {
        if (!otpSent) {
          handlePhoneSignup();
        } else {
          handleOtpSignupVerify();
        }
      }
    } else {
      if (mode === 'login') {
        handleEmailLogin();
      } else {
        handleEmailSignup();
      }
    }
  };

  // ---------- SOCIAL LOGIN ----------
  const handleSocialClick = (provider: 'google' | 'facebook') => {
    setShowSocialModal(provider);
    setSocialModalEmail('');
    setSocialError('');
  };

  const handleSocialAccountSelect = (selectedEmail: string) => {
    const users = getUsers();
    const existingUser = users.find(u => u.email === selectedEmail && u.role === role);

    if (existingUser) {
      setShowSocialModal(null);
      onAuth(role);
    } else {
      // New user — switch to signup with email pre-filled
      setShowSocialModal(null);
      setMode('signup');
      setEmail(selectedEmail);
      setMethod('email');
      setGeneralError('No account found with this email. Please complete your signup.');
      setShowPointingHand(false);
    }
  };

  const handleSocialCustomEmail = () => {
    if (!socialModalEmail.trim()) {
      setSocialError('Please enter an email address');
      return;
    }
    if (!isValidEmail(socialModalEmail)) {
      setSocialError('Please enter a valid email address');
      return;
    }
    handleSocialAccountSelect(socialModalEmail);
  };

  // ---------- FORGOT PASSWORD ----------
  const handleForgotPassword = () => {
    setShowForgotModal(true);
    setForgotStep(1);
    setForgotEmail('');
    setForgotCode('');
    setForgotCodeInput('');
    setNewPassword('');
    setConfirmNewPassword('');
    setForgotError('');
  };

  const handleForgotSendCode = () => {
    setForgotError('');

    if (!forgotEmail.trim()) {
      setForgotError('Please enter your email address');
      return;
    }
    if (!isValidEmail(forgotEmail)) {
      setForgotError('Please enter a valid email address');
      return;
    }

    const users = getUsers();
    const existingUser = users.find(u => u.email === forgotEmail);

    if (!existingUser) {
      setForgotError('No account found with this email');
      return;
    }

    const newCode = String(Math.floor(100000 + Math.random() * 900000));
    setForgotCode(newCode);
    setForgotStep(2);
    setForgotError('');
  };

  const handleForgotVerifyCode = () => {
    setForgotError('');

    if (!forgotCodeInput.trim()) {
      setForgotError('Please enter the verification code');
      return;
    }
    if (forgotCodeInput !== forgotCode) {
      setForgotError('Incorrect code. Please try again.');
      return;
    }

    setForgotStep(3);
    setForgotError('');
  };

  const handleForgotResetPassword = () => {
    setForgotError('');

    if (!newPassword.trim()) {
      setForgotError('Please enter a new password');
      return;
    }
    if (newPassword.length < 4) {
      setForgotError('Password must be at least 4 characters');
      return;
    }
    if (!confirmNewPassword.trim()) {
      setForgotError('Please confirm your new password');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setForgotError('Passwords do not match');
      return;
    }

    // Update user's password in localStorage
    const users = getUsers();
    const userIndex = users.findIndex(u => u.email === forgotEmail);
    if (userIndex !== -1) {
      users[userIndex].password = newPassword;
      saveUsers(users);
    }

    setShowForgotModal(false);
    setPassword('');
    setForgotSuccess('Password reset successful! Please log in with your new password.');
  };

  // Clear errors on input
  const clearFieldError = (field: string) => {
    if (field === 'general') { setGeneralError(''); setForgotSuccess(''); }
    if (field === 'phone') setPhoneError('');
    if (field === 'otp') setOtpError('');
    if (field === 'email') setEmailError('');
    if (field === 'password') setPasswordError('');
    if (field === 'confirm') setConfirmPasswordError('');
    if (field === 'name') setNameError('');
    if (field === 'pointing') setShowPointingHand(false);
  };

  // Google & Facebook SVG icons
  const GoogleIcon = () => (
    <svg className="h-5 w-5" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );

  const FacebookIcon = () => (
    <svg className="h-5 w-5 text-white" fill="currentColor" viewBox="0 0 24 24">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );

  return (
    <div className="flex min-h-screen">
      {/* Left brand panel */}
      <div className="hidden w-1/2 flex-col justify-between bg-navy-600 p-12 lg:flex">
        <Logo size="lg" variant="light" />
        <div>
          <h1 className="text-4xl font-bold leading-tight text-white">
            Build smarter.<br />Hire better.
          </h1>
          <p className="mt-4 max-w-sm text-lg text-navy-100">
            AI-powered contractor recommendations for your construction projects. Verified professionals, fair quotes, real-time tracking.
          </p>
          <div className="mt-8 flex items-center gap-6 text-sm text-navy-100">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-amber-400" /> 2,400+ Contractors
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-amber-400" /> 18,000+ Projects
            </div>
          </div>
        </div>
        <p className="text-sm text-white/70">© 2026 SmartBuild. All rights reserved.</p>
      </div>

      {/* Right form panel */}
      <div className="flex w-full flex-col items-center justify-center bg-white px-6 py-12 lg:w-1/2">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <Logo size="md" variant="dark" />
          </div>

          {/* Role toggle */}
          <div className="mb-6 flex rounded-lg bg-gray-100 p-1">
            <button
              onClick={() => setRole('client')}
              className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
                role === 'client' ? 'bg-white text-navy-700 shadow-soft' : 'text-gray-500'
              }`}
            >
              I'm a Client
            </button>
            <button
              onClick={() => setRole('contractor')}
              className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
                role === 'contractor' ? 'bg-white text-navy-700 shadow-soft' : 'text-gray-500'
              }`}
            >
              I'm a Contractor
            </button>
          </div>

          {/* Language dropdown */}
          <div className="mb-6 flex justify-end">
            <div className="relative">
              <button
                onClick={() => setLangOpen(!langOpen)}
                className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-navy-600"
              >
                {language} <ChevronDown className="h-4 w-4" />
              </button>
              {langOpen && (
                <div className="absolute right-0 top-8 z-10 w-28 rounded-lg border border-gray-100 bg-white py-1 shadow-card">
                  {['EN', 'हिं', 'தம', 'తె', 'বাং'].map((l) => (
                    <button
                      key={l}
                      onClick={() => { setLanguage(l); setLangOpen(false); }}
                      className="block w-full px-3 py-1.5 text-left text-sm text-navy-600 hover:bg-navy-50"
                    >
                      {l}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <h2 className="text-2xl font-bold text-navy-700">
            {mode === 'login' ? 'Welcome back' : 'Create your account'}
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            {role === 'client' ? 'Find the right contractor for your project.' : 'Grow your business with quality leads.'}
          </p>

          {/* Forgot password success message */}
          {forgotSuccess && (
            <div className="mt-4 flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
              <span className="text-sm text-emerald-600">{forgotSuccess}</span>
            </div>
          )}

          {/* General error banner */}
          {generalError && (
            <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
              <span className="text-sm text-red-600">{generalError}</span>
            </div>
          )}

          {/* Method toggle */}
          <div className="mt-6 flex gap-2">
            <button
              onClick={() => setMethod('phone')}
              className={`flex-1 rounded-lg border py-2 text-sm font-medium transition-colors ${
                method === 'phone' ? 'border-navy-600 bg-navy-50 text-navy-700' : 'border-gray-200 text-gray-500'
              }`}
            >
              Phone OTP
            </button>
            <button
              onClick={() => setMethod('email')}
              className={`flex-1 rounded-lg border py-2 text-sm font-medium transition-colors ${
                method === 'email' ? 'border-navy-600 bg-navy-50 text-navy-700' : 'border-gray-200 text-gray-500'
              }`}
            >
              Email
            </button>
          </div>

          {/* Form */}
          <div className="mt-5 space-y-3">
            {/* === NAME FIELD (signup only) === */}
            {mode === 'signup' && (
              <div>
                <div className={`flex items-center gap-2 rounded-lg border px-3 py-3 ${nameError ? 'border-red-400' : 'border-gray-200 focus-within:border-navy-400'}`}>
                  <input
                    type="text"
                    placeholder="Full name"
                    value={name}
                    onChange={(e) => { setName(e.target.value); clearFieldError('name'); }}
                    className="w-full bg-transparent text-sm text-navy-700 placeholder-gray-300 outline-none"
                  />
                </div>
                {nameError && <p className="mt-1 text-xs text-red-500">{nameError}</p>}
              </div>
            )}

            {/* === PHONE METHOD === */}
            {method === 'phone' && (
              <>
                <div>
                  <div className={`flex items-center gap-2 rounded-lg border px-3 py-3 ${phoneError ? 'border-red-400' : 'border-gray-200 focus-within:border-navy-400'}`}>
                    <Phone className="h-4 w-4 text-gray-400" />
                    <span className="text-sm text-gray-500">+91</span>
                    <input
                      type="tel"
                      placeholder="98765 43210"
                      value={phone}
                      disabled={otpSent}
                      onChange={(e) => { setPhone(e.target.value); clearFieldError('phone'); }}
                      className="w-full bg-transparent text-sm text-navy-700 placeholder-gray-300 outline-none disabled:bg-gray-50"
                    />
                  </div>
                  {phoneError && <p className="mt-1 text-xs text-red-500">{phoneError}</p>}
                </div>

                {otpSent && (
                  <div>
                    <div className={`flex items-center gap-2 rounded-lg border px-3 py-3 ${otpError ? 'border-red-400' : 'border-gray-200 focus-within:border-navy-400'}`}>
                      <Lock className="h-4 w-4 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Enter 6-digit OTP"
                        value={otp}
                        onChange={(e) => { setOtp(e.target.value); clearFieldError('otp'); }}
                        className="w-full bg-transparent text-sm text-navy-700 placeholder-gray-300 outline-none"
                      />
                    </div>
                    {otpError && <p className="mt-1 text-xs text-red-500">{otpError}</p>}
                    {otpMessage && <p className="mt-1 text-xs text-navy-500">{otpMessage}</p>}
                  </div>
                )}

                {!otpSent && mode === 'signup' && (
                  <p className="text-xs text-gray-400">Click the button below to send an OTP to your phone.</p>
                )}
              </>
            )}

            {/* === EMAIL METHOD === */}
            {method === 'email' && (
              <>
                <div>
                  <div className={`flex items-center gap-2 rounded-lg border px-3 py-3 ${emailError ? 'border-red-400' : 'border-gray-200 focus-within:border-navy-400'}`}>
                    <Mail className="h-4 w-4 text-gray-400" />
                    <input
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => { setEmail(e.target.value); clearFieldError('email'); }}
                      className="w-full bg-transparent text-sm text-navy-700 placeholder-gray-300 outline-none"
                    />
                  </div>
                  {emailError && <p className="mt-1 text-xs text-red-500">{emailError}</p>}
                </div>

                <div>
                  <div className={`flex items-center gap-2 rounded-lg border px-3 py-3 ${passwordError ? 'border-red-400' : 'border-gray-200 focus-within:border-navy-400'}`}>
                    <Lock className="h-4 w-4 text-gray-400" />
                    <input
                      type="password"
                      placeholder="Password"
                      value={password}
                      onChange={(e) => { setPassword(e.target.value); clearFieldError('password'); }}
                      className="w-full bg-transparent text-sm text-navy-700 placeholder-gray-300 outline-none"
                    />
                  </div>
                  {passwordError && <p className="mt-1 text-xs text-red-500">{passwordError}</p>}
                </div>

                {/* Forgot password link (email login only) */}
                {mode === 'login' && (
                  <div className="flex justify-end">
                    <button
                      onClick={handleForgotPassword}
                      className="text-xs font-medium text-navy-500 hover:text-navy-700"
                    >
                      Forgot password?
                    </button>
                  </div>
                )}

                {mode === 'signup' && (
                  <div>
                    <div className={`flex items-center gap-2 rounded-lg border px-3 py-3 ${confirmPasswordError ? 'border-red-400' : 'border-gray-200 focus-within:border-navy-400'}`}>
                      <Lock className="h-4 w-4 text-gray-400" />
                      <input
                        type="password"
                        placeholder="Re-enter password"
                        value={confirmPassword}
                        onChange={(e) => { setConfirmPassword(e.target.value); clearFieldError('confirm'); }}
                        className="w-full bg-transparent text-sm text-navy-700 placeholder-gray-300 outline-none"
                      />
                    </div>
                    {confirmPasswordError && <p className="mt-1 text-xs text-red-500">{confirmPasswordError}</p>}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Submit button */}
          <button
            onClick={handleSubmit}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-amber-400 py-3 text-sm font-semibold text-navy-700 transition-colors hover:bg-amber-300"
          >
            {method === 'phone' && otpSent
              ? (mode === 'login' ? 'Verify & Log In' : 'Verify & Sign Up')
              : (mode === 'login' ? 'Log In' : 'Sign Up')}
            <ArrowRight className="h-4 w-4" />
          </button>

          {/* Social login divider + buttons (email method only) */}
          {method === 'email' && (
            <>
              <div className="my-4 flex items-center gap-3">
                <div className="h-px flex-1 bg-gray-200" />
                <span className="text-xs text-gray-400">or</span>
                <div className="h-px flex-1 bg-gray-200" />
              </div>

              <div className="space-y-2">
                <button
                  onClick={() => handleSocialClick('google')}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white py-2.5 text-sm font-medium text-navy-700 transition-colors hover:bg-gray-50"
                >
                  <GoogleIcon />
                  Continue with Google
                </button>
                <button
                  onClick={() => handleSocialClick('facebook')}
                  className="flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium text-white transition-colors hover:opacity-90"
                  style={{ backgroundColor: '#1877F2' }}
                >
                  <FacebookIcon />
                  Continue with Facebook
                </button>
              </div>
            </>
          )}

          {/* Login/Signup toggle + pointing hand */}
          <div className="relative mt-5 flex items-center justify-center">
            <p className="text-center text-sm text-gray-500">
              {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
              <button
                ref={signupLinkRef}
                onClick={() => {
                  setMode(mode === 'login' ? 'signup' : 'login');
                  setGeneralError('');
                  setShowPointingHand(false);
                  setOtpSent(false);
                }}
                className="font-semibold text-navy-600 hover:text-navy-700"
              >
                {mode === 'login' ? 'Sign up' : 'Log in'}
              </button>
            </p>

            {/* Pointing hand animation for new users */}
            {showPointingHand && mode === 'login' && (
              <div className="pointer-events-none absolute -right-2 top-0 flex items-center gap-1">
                <span className="text-xs font-medium text-amber-600">Sign up here</span>
                <Hand
                  className="h-8 w-8 text-amber-500"
                  style={{
                    animation: 'pointBounce 1s ease-in-out infinite',
                    transform: 'scaleX(-1)',
                  }}
                  fill="currentColor"
                />
              </div>
            )}
          </div>

          {/* Resend OTP (phone, otp sent) */}
          {method === 'phone' && otpSent && (
            <button
              onClick={() => {
                const newOtp = String(Math.floor(100000 + Math.random() * 900000));
                setGeneratedOtp(newOtp);
                setOtpMessage(`OTP resent. (Demo OTP: ${newOtp})`);
                setOtpError('');
              }}
              className="mt-4 w-full text-center text-xs text-navy-500 hover:text-navy-700"
            >
              Resend OTP
            </button>
          )}

          <button
            onClick={() => onAuth('admin')}
            className="mt-4 w-full text-center text-xs text-gray-400 hover:text-navy-500"
          >
            Admin portal →
          </button>
        </div>
      </div>

      {/* === SOCIAL LOGIN MODAL === */}
      {showSocialModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-navy-900/40 backdrop-blur-sm" onClick={() => setShowSocialModal(null)} />
          <div className="relative z-10 w-full max-w-sm rounded-2xl bg-white p-6 shadow-float">
            <button
              onClick={() => setShowSocialModal(null)}
              className="absolute right-4 top-4 rounded-lg p-1.5 text-gray-400 hover:bg-gray-50"
            >
              <X className="h-5 w-5" />
            </button>

            {showSocialModal === 'google' ? (
              <>
                <div className="mb-4 flex justify-center">
                  <svg className="h-10 w-10" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                </div>
                <h3 className="mb-4 text-center text-lg font-semibold text-navy-700">Sign in with Google</h3>

                <p className="mb-2 text-sm text-gray-500">Choose an account</p>

                <button
                  onClick={() => handleSocialAccountSelect('arjun@gmail.com')}
                  className="flex w-full items-center gap-3 rounded-lg p-3 text-left hover:bg-gray-50"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-red-100 text-sm font-medium text-red-600">A</div>
                  <div>
                    <p className="text-sm font-medium text-navy-700">Arjun Mehta</p>
                    <p className="text-xs text-gray-500">arjun@gmail.com</p>
                  </div>
                </button>

                <button
                  onClick={() => handleSocialAccountSelect('priya@gmail.com')}
                  className="flex w-full items-center gap-3 rounded-lg p-3 text-left hover:bg-gray-50"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-purple-100 text-sm font-medium text-purple-600">P</div>
                  <div>
                    <p className="text-sm font-medium text-navy-700">Priya Sharma</p>
                    <p className="text-xs text-gray-500">priya@gmail.com</p>
                  </div>
                </button>

                <div className="my-3 flex items-center gap-3">
                  <div className="h-px flex-1 bg-gray-200" />
                  <span className="text-xs text-gray-400">or use another email</span>
                  <div className="h-px flex-1 bg-gray-200" />
                </div>

                <div className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2.5 focus-within:border-navy-400">
                  <Mail className="h-4 w-4 text-gray-400" />
                  <input
                    type="email"
                    placeholder="Enter your email"
                    value={socialModalEmail}
                    onChange={(e) => { setSocialModalEmail(e.target.value); setSocialError(''); }}
                    className="w-full bg-transparent text-sm text-navy-700 placeholder-gray-300 outline-none"
                  />
                </div>
                {socialError && <p className="mt-1 text-xs text-red-500">{socialError}</p>}

                <button
                  onClick={handleSocialCustomEmail}
                  className="mt-3 w-full rounded-lg bg-amber-400 py-2.5 text-sm font-semibold text-navy-700 hover:bg-amber-300"
                >
                  Continue
                </button>
              </>
            ) : (
              <>
                <div className="mb-4 flex justify-center rounded-xl py-2" style={{ backgroundColor: '#1877F2' }}>
                  <svg className="h-8 w-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                  </svg>
                </div>
                <h3 className="mb-4 text-center text-lg font-semibold text-navy-700">Continue as</h3>

                <button
                  onClick={() => handleSocialAccountSelect('arjun@gmail.com')}
                  className="flex w-full items-center gap-3 rounded-lg p-3 text-left hover:bg-gray-50"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-full" style={{ backgroundColor: '#1877F2' }}>
                    <span className="text-sm font-medium text-white">A</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-navy-700">Arjun Mehta</p>
                    <p className="text-xs text-gray-500">arjun@gmail.com</p>
                  </div>
                </button>

                <button
                  onClick={() => handleSocialAccountSelect('priya@gmail.com')}
                  className="flex w-full items-center gap-3 rounded-lg p-3 text-left hover:bg-gray-50"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-full" style={{ backgroundColor: '#1877F2' }}>
                    <span className="text-sm font-medium text-white">P</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-navy-700">Priya Sharma</p>
                    <p className="text-xs text-gray-500">priya@gmail.com</p>
                  </div>
                </button>

                <div className="my-3 flex items-center gap-3">
                  <div className="h-px flex-1 bg-gray-200" />
                  <span className="text-xs text-gray-400">or use another email</span>
                  <div className="h-px flex-1 bg-gray-200" />
                </div>

                <div className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2.5 focus-within:border-navy-400">
                  <Mail className="h-4 w-4 text-gray-400" />
                  <input
                    type="email"
                    placeholder="Enter your email"
                    value={socialModalEmail}
                    onChange={(e) => { setSocialModalEmail(e.target.value); setSocialError(''); }}
                    className="w-full bg-transparent text-sm text-navy-700 placeholder-gray-300 outline-none"
                  />
                </div>
                {socialError && <p className="mt-1 text-xs text-red-500">{socialError}</p>}

                <button
                  onClick={handleSocialCustomEmail}
                  className="mt-3 w-full rounded-lg py-2.5 text-sm font-semibold text-white hover:opacity-90"
                  style={{ backgroundColor: '#1877F2' }}
                >
                  Continue
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* === FORGOT PASSWORD MODAL === */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-navy-900/40 backdrop-blur-sm" onClick={() => setShowForgotModal(false)} />
          <div className="relative z-10 w-full max-w-sm rounded-2xl bg-white p-6 shadow-float">
            <button
              onClick={() => setShowForgotModal(false)}
              className="absolute right-4 top-4 rounded-lg p-1.5 text-gray-400 hover:bg-gray-50"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="mb-4 text-lg font-semibold text-navy-700">Reset Password</h3>

            {/* Step 1 — Enter email */}
            {forgotStep === 1 && (
              <>
                <p className="mb-3 text-sm text-gray-500">Enter your email address and we'll send you a verification code.</p>
                <div className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-3 focus-within:border-navy-400">
                  <Mail className="h-4 w-4 text-gray-400" />
                  <input
                    type="email"
                    placeholder="you@example.com"
                    value={forgotEmail}
                    onChange={(e) => { setForgotEmail(e.target.value); setForgotError(''); }}
                    className="w-full bg-transparent text-sm text-navy-700 placeholder-gray-300 outline-none"
                  />
                </div>
                {forgotError && <p className="mt-1 text-xs text-red-500">{forgotError}</p>}
                <button
                  onClick={handleForgotSendCode}
                  className="mt-4 w-full rounded-lg bg-amber-400 py-2.5 text-sm font-semibold text-navy-700 hover:bg-amber-300"
                >
                  Send Reset Code
                </button>
              </>
            )}

            {/* Step 2 — Verification code */}
            {forgotStep === 2 && (
              <>
                <p className="mb-3 text-sm text-gray-500">
                  Reset code sent to <span className="font-medium text-navy-700">{forgotEmail}</span>. (Demo code: {forgotCode})
                </p>
                <div className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-3 focus-within:border-navy-400">
                  <Lock className="h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Enter 6-digit code"
                    value={forgotCodeInput}
                    onChange={(e) => { setForgotCodeInput(e.target.value); setForgotError(''); }}
                    className="w-full bg-transparent text-sm text-navy-700 placeholder-gray-300 outline-none"
                  />
                </div>
                {forgotError && <p className="mt-1 text-xs text-red-500">{forgotError}</p>}
                <button
                  onClick={handleForgotVerifyCode}
                  className="mt-4 w-full rounded-lg bg-amber-400 py-2.5 text-sm font-semibold text-navy-700 hover:bg-amber-300"
                >
                  Verify Code
                </button>
              </>
            )}

            {/* Step 3 — New password */}
            {forgotStep === 3 && (
              <>
                <p className="mb-3 text-sm text-gray-500">Enter your new password.</p>
                <div className="mb-3 flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-3 focus-within:border-navy-400">
                  <Lock className="h-4 w-4 text-gray-400" />
                  <input
                    type="password"
                    placeholder="New password"
                    value={newPassword}
                    onChange={(e) => { setNewPassword(e.target.value); setForgotError(''); }}
                    className="w-full bg-transparent text-sm text-navy-700 placeholder-gray-300 outline-none"
                  />
                </div>
                <div className="mb-3 flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-3 focus-within:border-navy-400">
                  <Lock className="h-4 w-4 text-gray-400" />
                  <input
                    type="password"
                    placeholder="Confirm new password"
                    value={confirmNewPassword}
                    onChange={(e) => { setConfirmNewPassword(e.target.value); setForgotError(''); }}
                    className="w-full bg-transparent text-sm text-navy-700 placeholder-gray-300 outline-none"
                  />
                </div>
                {forgotError && <p className="mb-2 text-xs text-red-500">{forgotError}</p>}
                <button
                  onClick={handleForgotResetPassword}
                  className="mt-2 w-full rounded-lg bg-amber-400 py-2.5 text-sm font-semibold text-navy-700 hover:bg-amber-300"
                >
                  Reset Password
                </button>
              </>
            )}

            <button
              onClick={() => setShowForgotModal(false)}
              className="mt-4 w-full text-center text-xs text-gray-400 hover:text-navy-500"
            >
              Back to login
            </button>
          </div>
        </div>
      )}

      {/* Keyframe animation for pointing hand */}
      <style>{`
        @keyframes pointBounce {
          0%, 100% { transform: scaleX(-1) translateX(0); }
          50% { transform: scaleX(-1) translateX(-8px); }
        }
      `}</style>
    </div>
  );
}
