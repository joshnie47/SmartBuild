import { useState, useRef, useEffect } from 'react';
import {
  Phone, Mail, Lock, ChevronDown, ArrowRight, CheckCircle2, X,
  ArrowLeft, Loader2, KeyRound, Eye, EyeOff,
} from 'lucide-react';
import type { Role } from '../types';
import { Logo } from '../components/ui';
import { useLocale } from '../i18n/LocaleContext';
import { LOCALES, LOCALE_LABELS, type Locale, t } from '../i18n';
import {
  apiRegister, apiLogin,
  apiPhoneCheck, apiPhoneLogin, apiPhoneRegister, apiPhoneSetupPin,
  apiForgotPassword, apiVerifyResetOtp, apiResetPassword,
  apiForgotPin, apiResetPin,
} from '../lib/api';

// ---------- Helpers ----------
function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function AuthScreen({
  onAuth,
  onAdminPortal,
  defaultRole = 'client',
}: {
  onAuth: (role: Role, token?: string) => void;
  onAdminPortal: () => void;
  defaultRole?: Role;
}) {
  const { locale, setLocale } = useLocale();
  const [role, setRole] = useState<Role>(defaultRole);
  const [method, setMethod] = useState<'phone' | 'email'>('phone');
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [langOpen, setLangOpen] = useState(false);

  // Phone Form fields & PIN state
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [phoneStep, setPhoneStep] = useState<'input' | 'enter-pin' | 'create-pin' | 'setup-pin'>('input');

  // Email Form fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [name, setName] = useState('');

  // Loading state
  const [loading, setLoading] = useState(false);

  // Errors
  const [generalError, setGeneralError] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [pinError, setPinError] = useState('');
  const [confirmPinError, setConfirmPinError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');
  const [nameError, setNameError] = useState('');

  // Pointing hand animation
  const [showPointingHand, setShowPointingHand] = useState(false);
  const toggleLinkRef = useRef<HTMLButtonElement>(null);

  // Forgot Password state
  const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false);
  const [fpStep, setFpStep] = useState<1 | 2 | 3>(1);
  const [fpEmail, setFpEmail] = useState('');
  const [fpOtp, setFpOtp] = useState('');
  const [fpNewPassword, setFpNewPassword] = useState('');
  const [fpShowNewPassword, setFpShowNewPassword] = useState(false);
  const [fpConfirmPassword, setFpConfirmPassword] = useState('');
  const [fpShowConfirmPassword, setFpShowConfirmPassword] = useState(false);
  const [fpResetToken, setFpResetToken] = useState('');
  const [fpError, setFpError] = useState('');
  const [fpSuccess, setFpSuccess] = useState('');
  const [fpLoading, setFpLoading] = useState(false);
  const [fpResendCooldown, setFpResendCooldown] = useState(0);

  // Forgot PIN state
  const [showForgotPinModal, setShowForgotPinModal] = useState(false);
  const [pinStep, setPinStep] = useState<1 | 2 | 3>(1);
  const [pinIdentifier, setPinIdentifier] = useState('');
  const [pinEmail, setPinEmail] = useState('');
  const [pinMaskedEmail, setPinMaskedEmail] = useState('');
  const [pinOtp, setPinOtp] = useState('');
  const [pinNewPin, setPinNewPin] = useState('');
  const [pinShowNewPin, setPinShowNewPin] = useState(false);
  const [pinConfirmNewPin, setPinConfirmNewPin] = useState('');
  const [pinResetToken, setPinResetToken] = useState('');
  const [pinError2, setPinError2] = useState('');
  const [pinSuccess, setPinSuccess] = useState('');
  const [pinLoading, setPinLoading] = useState(false);
  const [pinNoEmail, setPinNoEmail] = useState(false);
  const [pinResendCooldown, setPinResendCooldown] = useState(0);

  // Clear errors when switching modes or methods
  useEffect(() => {
    setGeneralError('');
    setPhoneError('');
    setPinError('');
    setConfirmPinError('');
    setEmailError('');
    setPasswordError('');
    setConfirmPasswordError('');
    setNameError('');
    setShowPointingHand(false);
    setPhoneStep('input');
    setPin('');
    setConfirmPin('');
    setShowPin(false);
    setShowPassword(false);
    setShowConfirmPassword(false);
  }, [mode, method]);

  // Countdown timers for resend cooldowns
  useEffect(() => {
    let fpTimer: ReturnType<typeof setInterval>;
    if (fpResendCooldown > 0) {
      fpTimer = setInterval(() => setFpResendCooldown((prev) => prev - 1), 1000);
    }
    return () => clearInterval(fpTimer);
  }, [fpResendCooldown]);

  useEffect(() => {
    let pinTimer: ReturnType<typeof setInterval>;
    if (pinResendCooldown > 0) {
      pinTimer = setInterval(() => setPinResendCooldown((prev) => prev - 1), 1000);
    }
    return () => clearInterval(pinTimer);
  }, [pinResendCooldown]);

  // ── PHONE STEP 1: Check phone existence ──────────────────────────────────
  const handlePhoneStepOne = async () => {
    setGeneralError('');
    setPhoneError('');
    setNameError('');
    setShowPointingHand(false);

    if (mode === 'signup') {
      if (!name.trim()) {
        setNameError(t(locale, 'errEnterName'));
        return;
      }
      if (email.trim() && !isValidEmail(email.trim())) {
        setEmailError('Please enter a valid email address.');
        return;
      }
    }
    if (!phone.trim()) {
      setPhoneError(t(locale, 'errEnterPhone'));
      return;
    }
    const digits = phone.replace(/\D/g, '').slice(-10);
    if (digits.length < 10) {
      setPhoneError(t(locale, 'errValidPhone'));
      return;
    }

    const normalizedPhone = `+91${digits}`;
    setLoading(true);
    try {
      const { exists, hasPin, role: registeredRole, roleMismatch } = await apiPhoneCheck(normalizedPhone, role);
      if (mode === 'login') {
        if (!exists) {
          setGeneralError(t(locale, 'errNoAccount') || 'No account found with this phone number. Please sign up.');
          setShowPointingHand(true);
          return;
        }
        if (roleMismatch || (registeredRole && registeredRole.toLowerCase() !== role.toLowerCase())) {
          const actualRoleLabel = registeredRole?.toLowerCase() === 'contractor' ? 'Contractor' : 'Client';
          const targetTabLabel = registeredRole?.toLowerCase() === 'contractor' ? "I'm a Contractor" : "I'm a Client";
          setGeneralError(`This phone number is registered as a ${actualRoleLabel}. Please switch to "${targetTabLabel}" above to sign in.`);
          return;
        }
        if (!hasPin) {
          setPhoneStep('setup-pin');
          setGeneralError(t(locale, 'errSetupPinFirst') || 'Please set up your 6-digit PIN to continue.');
        } else {
          setPhoneStep('enter-pin');
        }
      } else {
        if (exists) {
          if (registeredRole && registeredRole.toLowerCase() !== role.toLowerCase()) {
            const actualRoleLabel = registeredRole.toLowerCase() === 'contractor' ? 'Contractor' : 'Client';
            const targetTabLabel = registeredRole.toLowerCase() === 'contractor' ? "I'm a Contractor" : "I'm a Client";
            setGeneralError(`This phone number is already registered as a ${actualRoleLabel}. Please switch to "${targetTabLabel}" to log in.`);
          } else {
            setGeneralError(t(locale, 'errPhoneExists') || 'An account with this phone number already exists. Please log in.');
            setShowPointingHand(true);
          }
          return;
        }
        setPhoneStep('create-pin');
      }
    } catch (err: unknown) {
      setGeneralError(err instanceof Error ? err.message : 'Unable to complete authentication. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── PHONE STEP 2: Login with PIN ─────────────────────────────────────────
  const handlePhoneLogin = async () => {
    setPinError('');
    setGeneralError('');
    if (!pin.trim()) { setPinError(t(locale, 'errEnterPin')); return; }
    if (!/^\d{6}$/.test(pin.trim())) { setPinError(t(locale, 'errValidPin')); return; }

    const digits = phone.replace(/\D/g, '').slice(-10);
    const normalizedPhone = `+91${digits}`;
    setLoading(true);
    try {
      const { token, user } = await apiPhoneLogin({ phone: normalizedPhone, pin: pin.trim(), role: role.toUpperCase() });
      if (user.role.toLowerCase() !== role.toLowerCase()) {
        const actualRoleLabel = user.role.toUpperCase() === 'CONTRACTOR' ? 'Contractor' : 'Client';
        const targetTabLabel = user.role.toUpperCase() === 'CONTRACTOR' ? "I'm a Contractor" : "I'm a Client";
        setGeneralError(`This account is registered as a ${actualRoleLabel}. Please switch to "${targetTabLabel}" to sign in.`);
        return;
      }
      onAuth(user.role.toLowerCase() as Role, token);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t(locale, 'errIncorrectPin');
      if (msg.includes('registered as a') || msg.includes('switch to')) {
        setGeneralError(msg);
      } else {
        setPinError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  // ── PHONE STEP 2: Signup with PIN ────────────────────────────────────────
  const handlePhoneSignup = async () => {
    setPinError('');
    setConfirmPinError('');
    setGeneralError('');
    if (!pin.trim()) { setPinError(t(locale, 'errEnterPin')); return; }
    if (!/^\d{6}$/.test(pin.trim())) { setPinError(t(locale, 'errValidPin')); return; }
    if (!confirmPin.trim()) { setConfirmPinError(t(locale, 'errConfirmPassword')); return; }
    if (pin.trim() !== confirmPin.trim()) { setConfirmPinError(t(locale, 'errPinMismatch')); return; }

    const digits = phone.replace(/\D/g, '').slice(-10);
    const normalizedPhone = `+91${digits}`;
    setLoading(true);
    try {
      const { token, user } = await apiPhoneRegister({
        fullName: name.trim(),
        phone: normalizedPhone,
        role: role.toUpperCase(),
        pin: pin.trim(),
        email: email.trim() || undefined,
      });
      onAuth(user.role.toLowerCase() as Role, token);
    } catch (err: unknown) {
      setPinError(err instanceof Error ? err.message : 'Unable to complete registration. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── PHONE STEP 2: Legacy User PIN Setup ──────────────────────────────────
  const handlePhoneSetupPin = async () => {
    setPinError('');
    setConfirmPinError('');
    setGeneralError('');
    if (!pin.trim()) { setPinError(t(locale, 'errEnterPin')); return; }
    if (!/^\d{6}$/.test(pin.trim())) { setPinError(t(locale, 'errValidPin')); return; }
    if (pin.trim() !== confirmPin.trim()) { setConfirmPinError(t(locale, 'errPinMismatch')); return; }

    const digits = phone.replace(/\D/g, '').slice(-10);
    const normalizedPhone = `+91${digits}`;
    setLoading(true);
    try {
      const { token, user } = await apiPhoneSetupPin({ phone: normalizedPhone, pin: pin.trim(), role: role.toUpperCase() });
      onAuth(user.role.toLowerCase() as Role, token);
    } catch (err: unknown) {
      setPinError(err instanceof Error ? err.message : 'Unable to set up PIN. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── EMAIL LOGIN ──────────────────────────────────────────────────────────
  const handleEmailLogin = async () => {
    setGeneralError('');
    setEmailError('');
    setPasswordError('');
    if (!email.trim()) { setEmailError(t(locale, 'errEnterEmail')); return; }
    if (!isValidEmail(email)) { setEmailError(t(locale, 'errValidEmail')); return; }
    if (!password.trim()) { setPasswordError(t(locale, 'errEnterPassword')); return; }

    setLoading(true);
    try {
      const { token, user } = await apiLogin(email, password, role.toUpperCase());
      if (user.role.toLowerCase() !== role.toLowerCase()) {
        const actualRoleLabel = user.role.toUpperCase() === 'CONTRACTOR' ? 'Contractor' : 'Client';
        const targetTabLabel = user.role.toUpperCase() === 'CONTRACTOR' ? "I'm a Contractor" : "I'm a Client";
        setGeneralError(`This account is registered as a ${actualRoleLabel}. Please switch to "${targetTabLabel}" to sign in.`);
        return;
      }
      onAuth(user.role.toLowerCase() as Role, token);
    } catch (err: unknown) {
      setGeneralError(err instanceof Error ? err.message : t(locale, 'errIncorrectCredentials'));
    } finally {
      setLoading(false);
    }
  };

  // ── EMAIL SIGNUP ─────────────────────────────────────────────────────────
  const handleEmailSignup = async () => {
    setGeneralError('');
    setNameError('');
    setEmailError('');
    setPasswordError('');
    setConfirmPasswordError('');
    if (!name.trim()) { setNameError(t(locale, 'errEnterName')); return; }
    if (!email.trim()) { setEmailError(t(locale, 'errEnterEmail')); return; }
    if (!isValidEmail(email)) { setEmailError(t(locale, 'errValidEmail')); return; }
    if (!password.trim()) { setPasswordError(t(locale, 'errEnterPasswordSignup')); return; }
    if (password.length < 6) { setPasswordError(t(locale, 'errPasswordLength')); return; }
    if (!confirmPassword.trim()) { setConfirmPasswordError(t(locale, 'errConfirmPassword')); return; }
    if (password !== confirmPassword) { setConfirmPasswordError(t(locale, 'errPasswordMismatch')); return; }

    setLoading(true);
    try {
      const { token, user } = await apiRegister({
        fullName: name.trim(),
        email: email.trim(),
        password,
        role: role === 'contractor' ? 'CONTRACTOR' : 'CLIENT',
      });
      onAuth(user.role.toLowerCase() as Role, token);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('already exists')) {
        setGeneralError(t(locale, 'errEmailExists'));
      } else {
        setGeneralError(msg || 'Registration failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Master submit ─────────────────────────────────────────────────────────
  const handleSubmit = () => {
    if (loading) return; // prevent duplicate submissions
    if (method === 'phone') {
      if (phoneStep === 'input') handlePhoneStepOne();
      else if (phoneStep === 'enter-pin') handlePhoneLogin();
      else if (phoneStep === 'create-pin') handlePhoneSignup();
      else if (phoneStep === 'setup-pin') handlePhoneSetupPin();
    } else {
      if (mode === 'login') handleEmailLogin();
      else handleEmailSignup();
    }
  };

  const clearFieldError = (field: string) => {
    if (field === 'name') setNameError('');
    if (field === 'phone') { setPhoneError(''); setGeneralError(''); setShowPointingHand(false); }
    if (field === 'pin') { setPinError(''); setGeneralError(''); }
    if (field === 'confirmPin') setConfirmPinError('');
    if (field === 'email') { setEmailError(''); setGeneralError(''); }
    if (field === 'password') setPasswordError('');
    if (field === 'confirm') setConfirmPasswordError('');
  };

  // ── Forgot Password handlers ──────────────────────────────────────────────
  const openForgotPassword = () => {
    setFpEmail(email);
    setFpStep(1);
    setFpError('');
    setFpSuccess('');
    setFpOtp('');
    setFpNewPassword('');
    setFpConfirmPassword('');
    setFpResetToken('');
    setFpShowNewPassword(false);
    setFpShowConfirmPassword(false);
    setShowForgotPasswordModal(true);
  };

  const closeForgotPassword = () => {
    setShowForgotPasswordModal(false);
  };

  const handleFpSendCode = async () => {
    setFpError('');
    if (!fpEmail.trim() || !isValidEmail(fpEmail)) {
      setFpError(t(locale, 'errValidEmail'));
      return;
    }
    setFpLoading(true);
    try {
      await apiForgotPassword(fpEmail.trim().toLowerCase());
      setFpStep(2);
      setFpResendCooldown(60);
    } catch (err) {
      setFpError(err instanceof Error ? err.message : 'Failed to send reset code. Please try again.');
    } finally {
      setFpLoading(false);
    }
  };

  const handleFpVerifyOtp = async () => {
    setFpError('');
    if (!fpOtp.trim()) { setFpError(t(locale, 'errEnterCode')); return; }
    if (!/^\d{6}$/.test(fpOtp.trim())) { setFpError('Verification code must be exactly 6 digits.'); return; }
    setFpLoading(true);
    try {
      const { resetToken } = await apiVerifyResetOtp(fpEmail.trim().toLowerCase(), fpOtp.trim(), 'password-reset');
      setFpResetToken(resetToken);
      setFpStep(3);
    } catch (err) {
      setFpError(err instanceof Error ? err.message : 'Incorrect or expired code. Please try again.');
    } finally {
      setFpLoading(false);
    }
  };

  const handleFpResetPassword = async () => {
    setFpError('');
    if (!fpNewPassword.trim()) { setFpError(t(locale, 'errEnterNewPassword')); return; }
    if (fpNewPassword.length < 6) { setFpError(t(locale, 'errPasswordLength')); return; }
    if (!fpConfirmPassword.trim()) { setFpError(t(locale, 'errConfirmPassword')); return; }
    if (fpNewPassword !== fpConfirmPassword) { setFpError(t(locale, 'errConfirmNewPassword')); return; }
    setFpLoading(true);
    try {
      await apiResetPassword(fpResetToken, fpNewPassword);
      setFpSuccess(t(locale, 'successPasswordReset') || 'Password reset successfully! You can now log in.');
      setTimeout(() => {
        setShowForgotPasswordModal(false);
        setPassword('');
      }, 2000);
    } catch (err) {
      setFpError(err instanceof Error ? err.message : 'Failed to reset password. Please start over.');
    } finally {
      setFpLoading(false);
    }
  };

  // ── Forgot PIN handlers ───────────────────────────────────────────────────
  const openForgotPin = () => {
    setPinStep(1);
    setPinIdentifier(phone ? phone : '');
    setPinEmail('');
    setPinMaskedEmail('');
    setPinOtp('');
    setPinNewPin('');
    setPinConfirmNewPin('');
    setPinResetToken('');
    setPinError2('');
    setPinSuccess('');
    setPinShowNewPin(false);
    setPinNoEmail(false);
    setShowForgotPinModal(true);
  };

  const closeForgotPin = () => {
    setShowForgotPinModal(false);
  };

  const handlePinSendCode = async () => {
    setPinError2('');
    const input = pinIdentifier.trim();
    if (!input) {
      setPinError2('Please enter your phone number or registered email.');
      return;
    }
    setPinLoading(true);
    try {
      const isEmail = isValidEmail(input);
      const payload = isEmail ? { email: input.toLowerCase() } : { phone: input };
      const res = await apiForgotPin(payload);
      if (res.noEmail) {
        setPinNoEmail(true);
        return;
      }
      if (res.email) setPinEmail(res.email);
      if (res.maskedEmail) setPinMaskedEmail(res.maskedEmail);
      setPinStep(2);
      setPinResendCooldown(60);
    } catch (err) {
      setPinError2(err instanceof Error ? err.message : 'Failed to send reset code. Please try again.');
    } finally {
      setPinLoading(false);
    }
  };

  const handlePinVerifyOtp = async () => {
    setPinError2('');
    if (!pinOtp.trim()) { setPinError2(t(locale, 'errEnterCode')); return; }
    if (!/^\d{6}$/.test(pinOtp.trim())) { setPinError2('Verification code must be exactly 6 digits.'); return; }
    setPinLoading(true);
    try {
      const { resetToken } = await apiVerifyResetOtp(pinEmail, pinOtp.trim(), 'pin-reset');
      setPinResetToken(resetToken);
      setPinStep(3);
    } catch (err) {
      setPinError2(err instanceof Error ? err.message : 'Incorrect or expired code. Please try again.');
    } finally {
      setPinLoading(false);
    }
  };

  const handlePinResetPin = async () => {
    setPinError2('');
    if (!pinNewPin.trim()) { setPinError2(t(locale, 'errEnterPin')); return; }
    if (!/^\d{6}$/.test(pinNewPin.trim())) { setPinError2(t(locale, 'errValidPin')); return; }
    if (!pinConfirmNewPin.trim()) { setPinError2(t(locale, 'errConfirmPassword')); return; }
    if (pinNewPin.trim() !== pinConfirmNewPin.trim()) { setPinError2(t(locale, 'errPinMismatch')); return; }
    setPinLoading(true);
    try {
      await apiResetPin(pinResetToken, pinNewPin.trim());
      setPinSuccess('PIN reset successfully! You can now log in with your new PIN.');
      setTimeout(() => {
        setShowForgotPinModal(false);
      }, 2000);
    } catch (err) {
      setPinError2(err instanceof Error ? err.message : 'Failed to reset PIN. Please start over.');
    } finally {
      setPinLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <style>{`
        @keyframes pointHandBounce {
          0%, 100% { transform: translateX(0); }
          50% { transform: translateX(6px); }
        }
      `}</style>

      {/* Language Switcher */}
      <div className="absolute right-4 top-4 z-40">
        <div className="relative">
          <button
            onClick={() => setLangOpen(!langOpen)}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-navy-700 shadow-sm transition-colors hover:bg-gray-50"
          >
            <span>{LOCALE_LABELS[locale]}</span>
            <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
          </button>
          {langOpen && (
            <div className="absolute right-0 mt-1 w-36 rounded-lg border border-gray-200 bg-white py-1 shadow-lg z-50">
              {LOCALES.map((localeCode) => (
                <button
                  key={localeCode}
                  onClick={() => { setLocale(localeCode as Locale); setLangOpen(false); }}
                  className={`flex w-full items-center justify-between px-3 py-1.5 text-xs transition-colors hover:bg-gray-50 ${locale === localeCode ? 'font-semibold text-navy-700' : 'text-gray-600'}`}
                >
                  <span>{LOCALE_LABELS[localeCode as Locale]}</span>
                  <span className="text-[10px] text-gray-400">{localeCode.toUpperCase()}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Left panel — Branding */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between bg-navy-600 p-12 text-white relative overflow-hidden">
        <div className="relative z-10">
          <Logo size="lg" variant="light" />
        </div>
        <div className="relative z-10 space-y-6 max-w-md">
          <h1 className="text-4xl font-bold leading-tight whitespace-pre-line text-white">
            {t(locale, 'brandHeadline')}
          </h1>
          <p className="text-sm leading-relaxed text-gray-300">{t(locale, 'brandSubtitle')}</p>
          <div className="flex gap-4 pt-4">
            <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur-sm">
              <p className="text-2xl font-bold text-amber-400">2,400+</p>
              <p className="text-xs text-gray-300">Verified Contractors</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur-sm">
              <p className="text-2xl font-bold text-amber-400">18,000+</p>
              <p className="text-xs text-gray-300">Projects Completed</p>
            </div>
          </div>
        </div>
        <div className="relative z-10 text-xs text-gray-400">{t(locale, 'copyright')}</div>
      </div>

      {/* Right panel — Form */}
      <div className="flex flex-1 flex-col justify-center px-6 py-12 sm:px-12 lg:px-16">
        <div className="mx-auto w-full max-w-md">
          {/* Mobile Logo */}
          <div className="mb-8 lg:hidden">
            <Logo size="md" />
          </div>

          {/* Role selector buttons */}
          <div className="mb-6 grid grid-cols-2 gap-3">
            <button
              onClick={() => setRole('client')}
              className={`flex items-center justify-center gap-2 rounded-xl border p-3 text-sm font-medium transition-all ${role === 'client' ? 'border-navy-600 bg-navy-50 text-navy-700 shadow-sm' : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'}`}
            >
              <div className={`h-2 w-2 rounded-full ${role === 'client' ? 'bg-navy-600' : 'bg-transparent'}`} />
              {t(locale, 'imAClient')}
            </button>
            <button
              onClick={() => setRole('contractor')}
              className={`flex items-center justify-center gap-2 rounded-xl border p-3 text-sm font-medium transition-all ${role === 'contractor' ? 'border-navy-600 bg-navy-50 text-navy-700 shadow-sm' : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'}`}
            >
              <div className={`h-2 w-2 rounded-full ${role === 'contractor' ? 'bg-navy-600' : 'bg-transparent'}`} />
              {t(locale, 'imAContractor')}
            </button>
          </div>

          {/* Header */}
          <div className="space-y-1">
            <h2 className="text-2xl font-bold text-navy-700">
              {mode === 'login' ? t(locale, 'welcomeBack') : t(locale, 'createAccount')}
            </h2>
            <p className="text-sm text-gray-500">
              {role === 'client' ? t(locale, 'clientSubtitle') : t(locale, 'contractorSubtitle')}
            </p>
          </div>

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
              className={`flex-1 rounded-lg border py-2 text-sm font-medium transition-colors ${method === 'phone' ? 'border-navy-600 bg-navy-50 text-navy-700' : 'border-gray-200 text-gray-500'}`}
            >
              {t(locale, 'phonePin')}
            </button>
            <button
              onClick={() => setMethod('email')}
              className={`flex-1 rounded-lg border py-2 text-sm font-medium transition-colors ${method === 'email' ? 'border-navy-600 bg-navy-50 text-navy-700' : 'border-gray-200 text-gray-500'}`}
            >
              {t(locale, 'email')}
            </button>
          </div>

          {/* ── Form — Enter key via form onSubmit ── */}
          <form
            className="mt-5 space-y-3"
            onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}
          >
            {/* === PHONE METHOD === */}
            {method === 'phone' && (
              <>
                {/* STEP 1: Phone input & Name (if signup) */}
                {phoneStep === 'input' && (
                  <>
                    {mode === 'signup' && (
                      <>
                        <div>
                          <div className={`flex items-center gap-2 rounded-lg border px-3 py-3 ${nameError ? 'border-red-400' : 'border-gray-200 focus-within:border-navy-400'}`}>
                            <input
                              type="text"
                              placeholder={t(locale, 'fullName')}
                              value={name}
                              autoComplete="name"
                              onChange={(e) => { setName(e.target.value); clearFieldError('name'); }}
                              className="w-full bg-transparent text-sm text-navy-700 placeholder-gray-300 outline-none"
                            />
                          </div>
                          {nameError && <p className="mt-1 text-xs text-red-500">{nameError}</p>}
                        </div>
                        <div>
                          <div className={`flex items-center gap-2 rounded-lg border px-3 py-3 ${emailError ? 'border-red-400' : 'border-gray-200 focus-within:border-navy-400'}`}>
                            <Mail className="h-4 w-4 text-gray-400" />
                            <input
                              type="email"
                              placeholder="Email (optional — needed for PIN recovery)"
                              value={email}
                              autoComplete="email"
                              onChange={(e) => { setEmail(e.target.value); clearFieldError('email'); }}
                              className="w-full bg-transparent text-sm text-navy-700 placeholder-gray-300 outline-none"
                            />
                          </div>
                          <p className="mt-1 text-xs text-amber-600 font-medium">
                            💡 Add your email so you can reset your PIN if you forget it.
                          </p>
                          {emailError && <p className="mt-1 text-xs text-red-500">{emailError}</p>}
                        </div>
                      </>
                    )}
                    <div>
                      <div className={`flex items-center gap-2 rounded-lg border px-3 py-3 ${phoneError ? 'border-red-400' : 'border-gray-200 focus-within:border-navy-400'}`}>
                        <Phone className="h-4 w-4 text-gray-400" />
                        <span className="text-sm text-gray-500">+91</span>
                        <input
                          type="tel"
                          placeholder="98765 43210"
                          value={phone}
                          maxLength={10}
                          autoComplete="tel"
                          onChange={(e) => { setPhone(e.target.value.replace(/\D/g, '').slice(0, 10)); clearFieldError('phone'); }}
                          className="w-full bg-transparent text-sm text-navy-700 placeholder-gray-300 outline-none"
                        />
                      </div>
                      {phoneError && <p className="mt-1 text-xs text-red-500">{phoneError}</p>}
                    </div>
                  </>
                )}

                {/* STEP 2: Enter PIN (Phone Login) */}
                {phoneStep === 'enter-pin' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-gray-600">
                        {t(locale, 'enterPin')} for <span className="text-navy-700">+91 {phone.replace(/\D/g, '').slice(-10)}</span>
                      </p>
                      <button
                        type="button"
                        onClick={() => { setPhoneStep('input'); setPin(''); setPinError(''); }}
                        className="text-xs text-navy-600 hover:underline"
                      >
                        ← {t(locale, 'backBtn')}
                      </button>
                    </div>
                    <div className={`flex items-center gap-2 rounded-lg border px-3 py-3 ${pinError ? 'border-red-400' : 'border-gray-200 focus-within:border-navy-400'}`}>
                      <KeyRound className="h-4 w-4 text-gray-400" />
                      <input
                        type={showPin ? 'text' : 'password'}
                        placeholder={t(locale, 'enterPin')}
                        value={pin}
                        maxLength={6}
                        inputMode="numeric"
                        pattern="[0-9]*"
                        autoComplete="current-password"
                        autoFocus
                        onChange={(e) => { setPin(e.target.value.replace(/\D/g, '').slice(0, 6)); clearFieldError('pin'); }}
                        className="w-full bg-transparent text-sm font-mono tracking-widest text-navy-700 placeholder-gray-300 outline-none"
                      />
                      <button type="button" onClick={() => setShowPin(!showPin)} className="text-gray-400 hover:text-navy-600" tabIndex={-1}>
                        {showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {pinError && <p className="text-xs text-red-500">{pinError}</p>}
                    {/* Forgot PIN link */}
                    <div className="flex justify-end">
                      <button type="button" onClick={openForgotPin} className="text-xs font-medium text-navy-500 hover:text-navy-700">
                        Forgot PIN?
                      </button>
                    </div>
                  </div>
                )}

                {/* STEP 2: Create PIN (Phone Signup) */}
                {phoneStep === 'create-pin' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-gray-600">Set your 6-digit security PIN</p>
                      <button type="button" onClick={() => { setPhoneStep('input'); setPin(''); setConfirmPin(''); setPinError(''); setConfirmPinError(''); }} className="text-xs text-navy-600 hover:underline">
                        ← {t(locale, 'backBtn')}
                      </button>
                    </div>
                    <div>
                      <div className={`flex items-center gap-2 rounded-lg border px-3 py-3 ${pinError ? 'border-red-400' : 'border-gray-200 focus-within:border-navy-400'}`}>
                        <KeyRound className="h-4 w-4 text-gray-400" />
                        <input
                          type={showPin ? 'text' : 'password'}
                          placeholder={t(locale, 'createPin')}
                          value={pin}
                          maxLength={6}
                          inputMode="numeric"
                          pattern="[0-9]*"
                          autoComplete="new-password"
                          autoFocus
                          onChange={(e) => { setPin(e.target.value.replace(/\D/g, '').slice(0, 6)); clearFieldError('pin'); }}
                          className="w-full bg-transparent text-sm font-mono tracking-widest text-navy-700 placeholder-gray-300 outline-none"
                        />
                        <button type="button" onClick={() => setShowPin(!showPin)} className="text-gray-400 hover:text-navy-600" tabIndex={-1}>
                          {showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      {pinError && <p className="mt-1 text-xs text-red-500">{pinError}</p>}
                    </div>
                    <div>
                      <div className={`flex items-center gap-2 rounded-lg border px-3 py-3 ${confirmPinError ? 'border-red-400' : 'border-gray-200 focus-within:border-navy-400'}`}>
                        <KeyRound className="h-4 w-4 text-gray-400" />
                        <input
                          type={showPin ? 'text' : 'password'}
                          placeholder={t(locale, 'confirmPin')}
                          value={confirmPin}
                          maxLength={6}
                          inputMode="numeric"
                          pattern="[0-9]*"
                          autoComplete="new-password"
                          onChange={(e) => { setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 6)); clearFieldError('confirmPin'); }}
                          className="w-full bg-transparent text-sm font-mono tracking-widest text-navy-700 placeholder-gray-300 outline-none"
                        />
                      </div>
                      {confirmPinError && <p className="mt-1 text-xs text-red-500">{confirmPinError}</p>}
                    </div>
                  </div>
                )}

                {/* STEP 2: Legacy User Setup PIN */}
                {phoneStep === 'setup-pin' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-amber-700">{t(locale, 'errSetupPinFirst')}</p>
                      <button type="button" onClick={() => { setPhoneStep('input'); setPin(''); setConfirmPin(''); setPinError(''); setConfirmPinError(''); }} className="text-xs text-navy-600 hover:underline">
                        ← {t(locale, 'backBtn')}
                      </button>
                    </div>
                    <div>
                      <div className={`flex items-center gap-2 rounded-lg border px-3 py-3 ${pinError ? 'border-red-400' : 'border-gray-200 focus-within:border-navy-400'}`}>
                        <KeyRound className="h-4 w-4 text-gray-400" />
                        <input
                          type={showPin ? 'text' : 'password'}
                          placeholder={t(locale, 'createPin')}
                          value={pin}
                          maxLength={6}
                          inputMode="numeric"
                          pattern="[0-9]*"
                          autoComplete="new-password"
                          autoFocus
                          onChange={(e) => { setPin(e.target.value.replace(/\D/g, '').slice(0, 6)); clearFieldError('pin'); }}
                          className="w-full bg-transparent text-sm font-mono tracking-widest text-navy-700 placeholder-gray-300 outline-none"
                        />
                        <button type="button" onClick={() => setShowPin(!showPin)} className="text-gray-400 hover:text-navy-600" tabIndex={-1}>
                          {showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      {pinError && <p className="mt-1 text-xs text-red-500">{pinError}</p>}
                    </div>
                    <div>
                      <div className={`flex items-center gap-2 rounded-lg border px-3 py-3 ${confirmPinError ? 'border-red-400' : 'border-gray-200 focus-within:border-navy-400'}`}>
                        <KeyRound className="h-4 w-4 text-gray-400" />
                        <input
                          type={showPin ? 'text' : 'password'}
                          placeholder={t(locale, 'confirmPin')}
                          value={confirmPin}
                          maxLength={6}
                          inputMode="numeric"
                          pattern="[0-9]*"
                          autoComplete="new-password"
                          onChange={(e) => { setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 6)); clearFieldError('confirmPin'); }}
                          className="w-full bg-transparent text-sm font-mono tracking-widest text-navy-700 placeholder-gray-300 outline-none"
                        />
                      </div>
                      {confirmPinError && <p className="mt-1 text-xs text-red-500">{confirmPinError}</p>}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* === EMAIL METHOD === */}
            {method === 'email' && (
              <>
                {mode === 'signup' && (
                  <div>
                    <div className={`flex items-center gap-2 rounded-lg border px-3 py-3 ${nameError ? 'border-red-400' : 'border-gray-200 focus-within:border-navy-400'}`}>
                      <input
                        type="text"
                        placeholder={t(locale, 'fullName')}
                        value={name}
                        autoComplete="name"
                        onChange={(e) => { setName(e.target.value); clearFieldError('name'); }}
                        className="w-full bg-transparent text-sm text-navy-700 placeholder-gray-300 outline-none"
                      />
                    </div>
                    {nameError && <p className="mt-1 text-xs text-red-500">{nameError}</p>}
                  </div>
                )}

                <div>
                  <div className={`flex items-center gap-2 rounded-lg border px-3 py-3 ${emailError ? 'border-red-400' : 'border-gray-200 focus-within:border-navy-400'}`}>
                    <Mail className="h-4 w-4 text-gray-400" />
                    <input
                      type="email"
                      placeholder={t(locale, 'emailPlaceholder')}
                      value={email}
                      autoComplete="email"
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
                      type={showPassword ? 'text' : 'password'}
                      placeholder={t(locale, 'password')}
                      value={password}
                      autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                      onChange={(e) => { setPassword(e.target.value); clearFieldError('password'); }}
                      className="w-full bg-transparent text-sm text-navy-700 placeholder-gray-300 outline-none"
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="text-gray-400 hover:text-navy-600" tabIndex={-1}>
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {passwordError && <p className="mt-1 text-xs text-red-500">{passwordError}</p>}
                </div>

                {mode === 'login' && (
                  <div className="flex justify-end">
                    <button type="button" onClick={openForgotPassword} className="text-xs font-medium text-navy-500 hover:text-navy-700">
                      {t(locale, 'forgotPassword')}
                    </button>
                  </div>
                )}

                {mode === 'signup' && (
                  <div>
                    <div className={`flex items-center gap-2 rounded-lg border px-3 py-3 ${confirmPasswordError ? 'border-red-400' : 'border-gray-200 focus-within:border-navy-400'}`}>
                      <Lock className="h-4 w-4 text-gray-400" />
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        placeholder={t(locale, 'reEnterPassword')}
                        value={confirmPassword}
                        autoComplete="new-password"
                        onChange={(e) => { setConfirmPassword(e.target.value); clearFieldError('confirm'); }}
                        className="w-full bg-transparent text-sm text-navy-700 placeholder-gray-300 outline-none"
                      />
                      <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="text-gray-400 hover:text-navy-600" tabIndex={-1}>
                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {confirmPasswordError && <p className="mt-1 text-xs text-red-500">{confirmPasswordError}</p>}
                  </div>
                )}
              </>
            )}

            {/* Submit button (type="submit" so Enter key works) */}
            <button
              type="submit"
              disabled={loading}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-amber-400 py-3 text-sm font-semibold text-navy-700 transition-colors hover:bg-amber-300 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin text-navy-700" />
              ) : method === 'phone' ? (
                phoneStep === 'enter-pin' ? t(locale, 'signIn') :
                phoneStep === 'create-pin' ? t(locale, 'createAccountBtn') :
                phoneStep === 'setup-pin' ? 'Set Up PIN & Continue' :
                mode === 'login' ? t(locale, 'verifyLogIn') : t(locale, 'continueBtn')
              ) : mode === 'login' ? (
                t(locale, 'logIn')
              ) : (
                t(locale, 'signUp')
              )}
              {!loading && <ArrowRight className="h-4 w-4" />}
            </button>
          </form>

          {/* Login/Signup toggle + pointing hand */}
          <div className="relative mt-5 flex items-center justify-center">
            <p className="text-center text-sm text-gray-500">
              {mode === 'login' ? t(locale, 'noAccount') : t(locale, 'alreadyHaveAccount')}
              <span className="relative inline-flex items-center">
                <button
                  ref={toggleLinkRef}
                  onClick={() => {
                    setMode(mode === 'login' ? 'signup' : 'login');
                    setGeneralError('');
                    setShowPointingHand(false);
                    setPhoneStep('input');
                  }}
                  className="font-semibold text-navy-600 hover:text-navy-700"
                >
                  {mode === 'login' ? t(locale, 'signUpLink') : t(locale, 'logInLink')}
                </button>
                {showPointingHand && (
                  <span className="pointer-events-none absolute left-full top-1/2 flex -translate-y-1/2 items-center pl-2 whitespace-nowrap">
                    <span className="text-xs font-bold text-amber-600 mr-1">
                      {mode === 'login' ? 'Sign up here' : 'Log in here'}
                    </span>
                    <span className="text-lg inline-block" style={{ animation: 'pointHandBounce 0.8s ease-in-out infinite' }}>
                      👈
                    </span>
                  </span>
                )}
              </span>
            </p>
          </div>

          <button
            onClick={onAdminPortal}
            className="mt-4 w-full text-center text-xs text-gray-400 hover:text-navy-500"
          >
            {t(locale, 'adminPortal')}
          </button>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          FORGOT PASSWORD MODAL
      ════════════════════════════════════════════════════════════════════════ */}
      {showForgotPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-navy-900/40 backdrop-blur-sm" onClick={closeForgotPassword} />
          <div className="relative z-10 w-full max-w-sm rounded-2xl bg-white p-6 shadow-float">
            <button onClick={closeForgotPassword} className="absolute right-4 top-4 rounded-lg p-1.5 text-gray-400 hover:bg-gray-50">
              <X className="h-5 w-5" />
            </button>

            {fpSuccess ? (
              <div className="py-4 text-center">
                <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
                <p className="mt-3 text-sm font-semibold text-navy-700">{fpSuccess}</p>
              </div>
            ) : (
              <>
                <h3 className="text-lg font-bold text-navy-700">{t(locale, 'resetPassword')}</h3>

                {/* Step indicators */}
                <div className="mt-3 flex items-center gap-1">
                  {[1, 2, 3].map((s) => (
                    <div key={s} className={`h-1.5 flex-1 rounded-full transition-colors ${fpStep >= s ? 'bg-amber-400' : 'bg-gray-200'}`} />
                  ))}
                </div>

                {/* Step 1: Enter Email */}
                {fpStep === 1 && (
                  <form className="mt-4 space-y-3" onSubmit={(e) => { e.preventDefault(); handleFpSendCode(); }}>
                    <p className="text-xs text-gray-500">{t(locale, 'enterEmailForReset')}</p>
                    <div className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2.5 focus-within:border-navy-400">
                      <Mail className="h-4 w-4 text-gray-400" />
                      <input
                        type="email"
                        placeholder={t(locale, 'emailPlaceholder')}
                        value={fpEmail}
                        autoFocus
                        autoComplete="email"
                        onChange={(e) => setFpEmail(e.target.value)}
                        className="w-full bg-transparent text-sm text-navy-700 outline-none"
                      />
                    </div>
                    {fpError && <p className="text-xs text-red-500">{fpError}</p>}
                    <button
                      type="submit"
                      disabled={fpLoading}
                      className="flex w-full items-center justify-center gap-2 rounded-lg bg-amber-400 py-2.5 text-sm font-semibold text-navy-700 hover:bg-amber-300 disabled:opacity-60"
                    >
                      {fpLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : t(locale, 'sendResetCode')}
                    </button>
                  </form>
                )}

                {/* Step 2: Enter OTP */}
                {fpStep === 2 && (
                  <form className="mt-4 space-y-3" onSubmit={(e) => { e.preventDefault(); handleFpVerifyOtp(); }}>
                    <p className="text-xs text-gray-500">
                      A 6-digit reset code was sent to <strong>{fpEmail}</strong>. Check your inbox (and spam folder).
                    </p>
                    <div className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2.5 focus-within:border-navy-400">
                      <Lock className="h-4 w-4 text-gray-400" />
                      <input
                        type="text"
                        placeholder={t(locale, 'enterSixDigitCode')}
                        value={fpOtp}
                        maxLength={6}
                        inputMode="numeric"
                        autoFocus
                        autoComplete="one-time-code"
                        onChange={(e) => setFpOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        className="w-full bg-transparent text-sm font-mono tracking-widest text-navy-700 outline-none"
                      />
                    </div>
                    {fpError && <p className="text-xs text-red-500">{fpError}</p>}
                    <button
                      type="submit"
                      disabled={fpLoading}
                      className="flex w-full items-center justify-center gap-2 rounded-lg bg-amber-400 py-2.5 text-sm font-semibold text-navy-700 hover:bg-amber-300 disabled:opacity-60"
                    >
                      {fpLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : t(locale, 'verifyCode')}
                    </button>
                    <button type="button" disabled={fpResendCooldown > 0} onClick={() => { setFpStep(1); setFpOtp(''); setFpError(''); }} className="flex w-full items-center justify-center gap-1 text-xs text-gray-400 hover:text-navy-600 disabled:opacity-40 disabled:cursor-not-allowed">
                      <ArrowLeft className="h-3 w-3" /> {fpResendCooldown > 0 ? `Resend in ${fpResendCooldown}s` : 'Resend code'}
                    </button>
                  </form>
                )}

                {/* Step 3: Enter New Password */}
                {fpStep === 3 && (
                  <form className="mt-4 space-y-3" onSubmit={(e) => { e.preventDefault(); handleFpResetPassword(); }}>
                    <p className="text-xs text-gray-500">{t(locale, 'enterNewPassword')}</p>
                    <div>
                      <div className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2.5 focus-within:border-navy-400">
                        <Lock className="h-4 w-4 text-gray-400" />
                        <input
                          type={fpShowNewPassword ? 'text' : 'password'}
                          placeholder={t(locale, 'newPassword')}
                          value={fpNewPassword}
                          autoComplete="new-password"
                          autoFocus
                          onChange={(e) => setFpNewPassword(e.target.value)}
                          className="w-full bg-transparent text-sm text-navy-700 outline-none"
                        />
                        <button type="button" onClick={() => setFpShowNewPassword(!fpShowNewPassword)} className="text-gray-400 hover:text-navy-600" tabIndex={-1}>
                          {fpShowNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2.5 focus-within:border-navy-400">
                        <Lock className="h-4 w-4 text-gray-400" />
                        <input
                          type={fpShowConfirmPassword ? 'text' : 'password'}
                          placeholder={t(locale, 'confirmNewPassword')}
                          value={fpConfirmPassword}
                          autoComplete="new-password"
                          onChange={(e) => setFpConfirmPassword(e.target.value)}
                          className="w-full bg-transparent text-sm text-navy-700 outline-none"
                        />
                        <button type="button" onClick={() => setFpShowConfirmPassword(!fpShowConfirmPassword)} className="text-gray-400 hover:text-navy-600" tabIndex={-1}>
                          {fpShowConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                    {fpError && <p className="text-xs text-red-500">{fpError}</p>}
                    <button
                      type="submit"
                      disabled={fpLoading}
                      className="flex w-full items-center justify-center gap-2 rounded-lg bg-amber-400 py-2.5 text-sm font-semibold text-navy-700 hover:bg-amber-300 disabled:opacity-60"
                    >
                      {fpLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : t(locale, 'resetPassword')}
                    </button>
                  </form>
                )}

                <button onClick={closeForgotPassword} className="mt-3 flex w-full items-center justify-center gap-1 text-xs text-gray-400 hover:text-navy-600">
                  <ArrowLeft className="h-3 w-3" /> {t(locale, 'backToLogin')}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          FORGOT PIN MODAL
      ════════════════════════════════════════════════════════════════════════ */}
      {showForgotPinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-navy-900/40 backdrop-blur-sm" onClick={closeForgotPin} />
          <div className="relative z-10 w-full max-w-sm rounded-2xl bg-white p-6 shadow-float">
            <button onClick={closeForgotPin} className="absolute right-4 top-4 rounded-lg p-1.5 text-gray-400 hover:bg-gray-50">
              <X className="h-5 w-5" />
            </button>

            {pinSuccess ? (
              <div className="py-4 text-center">
                <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
                <p className="mt-3 text-sm font-semibold text-navy-700">{pinSuccess}</p>
              </div>
            ) : (
              <>
                <h3 className="text-lg font-bold text-navy-700">Reset PIN</h3>

                {/* Step indicators */}
                <div className="mt-3 flex items-center gap-1">
                  {[1, 2, 3].map((s) => (
                    <div key={s} className={`h-1.5 flex-1 rounded-full transition-colors ${pinStep >= s ? 'bg-amber-400' : 'bg-gray-200'}`} />
                  ))}
                </div>

                {/* Step 1: Enter Phone Number */}
                {pinStep === 1 && (
                  pinNoEmail ? (
                    <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-5 text-center space-y-3">
                      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100">
                        <Mail className="h-6 w-6 text-amber-600" />
                      </div>
                      <h4 className="text-sm font-bold text-navy-800">No Email Linked to This Account</h4>
                      <p className="text-xs text-gray-600 leading-relaxed">
                        To receive the reset code, your account needs a registered email address.
                      </p>
                      <div className="rounded-lg bg-white border border-amber-200 p-3 text-left space-y-2">
                        <p className="text-xs font-semibold text-navy-700">What you can do:</p>
                        <p className="text-xs text-gray-600">✅ If you can log in — add your email from the banner shown in your dashboard.</p>
                        <p className="text-xs text-gray-600">📞 Fully locked out — contact SmartBuild support.</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => { setPinNoEmail(false); setPinIdentifier(''); setPinError2(''); }}
                        className="text-xs text-navy-500 hover:text-navy-700 underline"
                      >
                        ← Try a different number
                      </button>
                    </div>
                  ) : (
                    <form className="mt-4 space-y-3" onSubmit={(e) => { e.preventDefault(); handlePinSendCode(); }}>
                      <p className="text-xs text-gray-500">Enter your registered phone number. We'll search MongoDB Atlas for your account and send an OTP verification code to your registered email address.</p>
                      <div className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2.5 focus-within:border-navy-400">
                        <Phone className="h-4 w-4 text-gray-400" />
                        <input
                          type="text"
                          placeholder="Registered phone number (+91...)"
                          value={pinIdentifier}
                          autoFocus
                          onChange={(e) => setPinIdentifier(e.target.value)}
                          className="w-full bg-transparent text-sm text-navy-700 outline-none"
                        />
                      </div>
                      {pinError2 && <p className="text-xs text-red-500">{pinError2}</p>}
                      <button
                        type="submit"
                        disabled={pinLoading}
                        className="flex w-full items-center justify-center gap-2 rounded-lg bg-amber-400 py-2.5 text-sm font-semibold text-navy-700 hover:bg-amber-300 disabled:opacity-60"
                      >
                        {pinLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send Verification Code'}
                      </button>
                    </form>
                  )
                )}

                {/* Step 2: Enter OTP */}
                {pinStep === 2 && (
                  <form className="mt-4 space-y-3" onSubmit={(e) => { e.preventDefault(); handlePinVerifyOtp(); }}>
                    <p className="text-xs text-gray-500">
                      Check your registered email! A 6-digit verification code was sent to <strong>{pinMaskedEmail || pinEmail}</strong>.
                    </p>
                    <div className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2.5 focus-within:border-navy-400">
                      <Lock className="h-4 w-4 text-gray-400" />
                      <input
                        type="text"
                        placeholder="6-digit code"
                        value={pinOtp}
                        maxLength={6}
                        inputMode="numeric"
                        autoFocus
                        autoComplete="one-time-code"
                        onChange={(e) => setPinOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        className="w-full bg-transparent text-sm font-mono tracking-widest text-navy-700 outline-none"
                      />
                    </div>
                    {pinError2 && <p className="text-xs text-red-500">{pinError2}</p>}
                    <button
                      type="submit"
                      disabled={pinLoading}
                      className="flex w-full items-center justify-center gap-2 rounded-lg bg-amber-400 py-2.5 text-sm font-semibold text-navy-700 hover:bg-amber-300 disabled:opacity-60"
                    >
                      {pinLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Verify Code'}
                    </button>
                    <button type="button" disabled={pinResendCooldown > 0} onClick={() => { setPinStep(1); setPinOtp(''); setPinError2(''); }} className="flex w-full items-center justify-center gap-1 text-xs text-gray-400 hover:text-navy-600 disabled:opacity-40 disabled:cursor-not-allowed">
                      <ArrowLeft className="h-3 w-3" /> {pinResendCooldown > 0 ? `Resend in ${pinResendCooldown}s` : 'Resend code'}
                    </button>
                  </form>
                )}

                {/* Step 3: Enter New PIN */}
                {pinStep === 3 && (
                  <form className="mt-4 space-y-3" onSubmit={(e) => { e.preventDefault(); handlePinResetPin(); }}>
                    <p className="text-xs text-gray-500">Set a new 6-digit PIN for your account.</p>
                    <div>
                      <div className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2.5 focus-within:border-navy-400">
                        <KeyRound className="h-4 w-4 text-gray-400" />
                        <input
                          type={pinShowNewPin ? 'text' : 'password'}
                          placeholder="New PIN (6 digits)"
                          value={pinNewPin}
                          maxLength={6}
                          inputMode="numeric"
                          autoFocus
                          autoComplete="new-password"
                          onChange={(e) => setPinNewPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          className="w-full bg-transparent text-sm font-mono tracking-widest text-navy-700 outline-none"
                        />
                        <button type="button" onClick={() => setPinShowNewPin(!pinShowNewPin)} className="text-gray-400 hover:text-navy-600" tabIndex={-1}>
                          {pinShowNewPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2.5 focus-within:border-navy-400">
                        <KeyRound className="h-4 w-4 text-gray-400" />
                        <input
                          type={pinShowNewPin ? 'text' : 'password'}
                          placeholder="Confirm new PIN"
                          value={pinConfirmNewPin}
                          maxLength={6}
                          inputMode="numeric"
                          autoComplete="new-password"
                          onChange={(e) => setPinConfirmNewPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          className="w-full bg-transparent text-sm font-mono tracking-widest text-navy-700 outline-none"
                        />
                      </div>
                    </div>
                    {pinError2 && <p className="text-xs text-red-500">{pinError2}</p>}
                    <button
                      type="submit"
                      disabled={pinLoading}
                      className="flex w-full items-center justify-center gap-2 rounded-lg bg-amber-400 py-2.5 text-sm font-semibold text-navy-700 hover:bg-amber-300 disabled:opacity-60"
                    >
                      {pinLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Reset PIN'}
                    </button>
                  </form>
                )}

                <button onClick={closeForgotPin} className="mt-3 flex w-full items-center justify-center gap-1 text-xs text-gray-400 hover:text-navy-600">
                  <ArrowLeft className="h-3 w-3" /> Back to Login
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
