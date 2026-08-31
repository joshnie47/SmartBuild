import { useState, useRef, useEffect } from 'react';
import { Phone, Mail, Lock, ChevronDown, ArrowRight, CheckCircle2, Hand, X, ArrowLeft, Loader2, KeyRound, Eye, EyeOff } from 'lucide-react';
import type { Role } from '../types';
import { Logo } from '../components/ui';
import { useLocale } from '../i18n/LocaleContext';
import { LOCALES, LOCALE_LABELS, t } from '../i18n';
import { apiRegister, apiLogin, apiPhoneCheck, apiPhoneLogin, apiPhoneRegister, apiPhoneSetupPin } from '../lib/api';

// ---------- Helpers ----------
function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function AuthScreen({ onAuth, onAdminPortal, defaultRole = 'client' }: { onAuth: (role: Role, token?: string) => void; onAdminPortal: () => void; defaultRole?: Role }) {
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
  const [confirmPassword, setConfirmPassword] = useState('');
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

  // Social login modal state
  const [showSocialModal, setShowSocialModal] = useState<null | 'google' | 'facebook'>(null);
  const [socialModalEmail, setSocialModalEmail] = useState('');
  const [socialError, setSocialError] = useState('');

  // Forgot password modal state
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotStep, setForgotStep] = useState<1 | 2 | 3>(1);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotCodeInput, setForgotCodeInput] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [forgotError, setForgotError] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState('');

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
  }, [mode, method]);

  // ---------- PHONE STEP 1: Check phone existence ----------
  const handlePhoneStepOne = async () => {
    setGeneralError('');
    setPhoneError('');
    setNameError('');
    setShowPointingHand(false);

    if (mode === 'signup' && !name.trim()) {
      setNameError(t(locale, 'errEnterName'));
      return;
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

        // Strict Role Check: Contractor vs Client
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
        // Sign Up
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

  // ---------- PHONE STEP 2: Login with PIN ----------
  const handlePhoneLogin = async () => {
    setPinError('');
    setGeneralError('');

    if (!pin.trim()) {
      setPinError(t(locale, 'errEnterPin'));
      return;
    }
    if (!/^\d{6}$/.test(pin.trim())) {
      setPinError(t(locale, 'errValidPin'));
      return;
    }

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

  // ---------- PHONE STEP 2: Signup with PIN ----------
  const handlePhoneSignup = async () => {
    setPinError('');
    setConfirmPinError('');
    setGeneralError('');

    if (!pin.trim()) {
      setPinError(t(locale, 'errEnterPin'));
      return;
    }
    if (!/^\d{6}$/.test(pin.trim())) {
      setPinError(t(locale, 'errValidPin'));
      return;
    }
    if (!confirmPin.trim()) {
      setConfirmPinError(t(locale, 'errConfirmPassword'));
      return;
    }
    if (pin.trim() !== confirmPin.trim()) {
      setConfirmPinError(t(locale, 'errPinMismatch'));
      return;
    }

    const digits = phone.replace(/\D/g, '').slice(-10);
    const normalizedPhone = `+91${digits}`;

    setLoading(true);
    try {
      const { token, user } = await apiPhoneRegister({
        fullName: name.trim(),
        phone: normalizedPhone,
        role: role.toUpperCase(),
        pin: pin.trim(),
      });
      onAuth(user.role.toLowerCase() as Role, token);
    } catch (err: unknown) {
      setPinError(err instanceof Error ? err.message : 'Unable to complete registration. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ---------- PHONE STEP 2: Legacy User PIN Setup ----------
  const handlePhoneSetupPin = async () => {
    setPinError('');
    setConfirmPinError('');
    setGeneralError('');

    if (!pin.trim()) {
      setPinError(t(locale, 'errEnterPin'));
      return;
    }
    if (!/^\d{6}$/.test(pin.trim())) {
      setPinError(t(locale, 'errValidPin'));
      return;
    }
    if (pin.trim() !== confirmPin.trim()) {
      setConfirmPinError(t(locale, 'errPinMismatch'));
      return;
    }

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

  // ---------- EMAIL LOGIN ----------
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

  // ---------- EMAIL SIGNUP ----------
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

  // Master submit
  const handleSubmit = () => {
    if (method === 'phone') {
      if (phoneStep === 'input') {
        handlePhoneStepOne();
      } else if (phoneStep === 'enter-pin') {
        handlePhoneLogin();
      } else if (phoneStep === 'create-pin') {
        handlePhoneSignup();
      } else if (phoneStep === 'setup-pin') {
        handlePhoneSetupPin();
      }
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

  // Social click
  const handleSocialClick = (provider: 'google' | 'facebook') => {
    setSocialError('');
    setShowSocialModal(provider);
  };

  const handleSocialAccountSelect = (selectedEmail: string) => {
    const roleUpper = role === 'contractor' ? 'CONTRACTOR' : 'CLIENT';
    apiRegister({
      fullName: selectedEmail.split('@')[0],
      email: selectedEmail,
      password: 'SocialLogin_OAuth2.0_Verified!',
      role: roleUpper,
    })
      .then(({ token, user }) => {
        setShowSocialModal(null);
        onAuth(user.role.toLowerCase() as Role, token);
      })
      .catch(() => {
        apiLogin(selectedEmail, 'SocialLogin_OAuth2.0_Verified!')
          .then(({ token, user }) => {
            setShowSocialModal(null);
            onAuth(user.role.toLowerCase() as Role, token);
          })
          .catch(() => {
            setShowSocialModal(null);
            onAuth(role);
          });
      });
  };

  // Forgot password
  const handleForgotPassword = () => {
    setForgotEmail(email);
    setForgotStep(1);
    setForgotError('');
    setForgotSuccess('');
    setShowForgotModal(true);
  };

  const handleSendResetCode = () => {
    setForgotError('');
    if (!forgotEmail.trim() || !isValidEmail(forgotEmail)) {
      setForgotError(t(locale, 'errValidEmail'));
      return;
    }
    setForgotStep(2);
  };

  const handleVerifyResetCode = () => {
    setForgotError('');
    if (!forgotCodeInput.trim()) {
      setForgotError(t(locale, 'errEnterCode'));
      return;
    }
    setForgotStep(3);
  };

  const handleResetPassword = () => {
    setForgotError('');
    if (!newPassword.trim()) {
      setForgotError(t(locale, 'errEnterNewPassword'));
      return;
    }
    if (newPassword.length < 6) {
      setForgotError(t(locale, 'errPasswordLength'));
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setForgotError(t(locale, 'errConfirmNewPassword'));
      return;
    }
    setForgotSuccess(t(locale, 'successPasswordReset'));
    setTimeout(() => {
      setShowForgotModal(false);
    }, 1500);
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <style>{`
        @keyframes pointHandBounce {
          0%, 100% { transform: translateX(0); }
          50% { transform: translateX(6px); }
        }
      `}</style>

      {/* Language Switcher — Top Right */}
      <div className="absolute right-4 top-4 z-40">
        <div className="relative">
          <button
            onClick={() => setLangOpen(!langOpen)}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-navy-700 shadow-sm transition-colors hover:bg-gray-50"
          >
            <span>{LOCALES.find((l) => l.code === locale)?.label}</span>
            <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
          </button>
          {langOpen && (
            <div className="absolute right-0 mt-1 w-36 rounded-lg border border-gray-200 bg-white py-1 shadow-lg z-50">
              {LOCALES.map((l) => (
                <button
                  key={l.code}
                  onClick={() => {
                    setLocale(l.code);
                    setLangOpen(false);
                  }}
                  className={`flex w-full items-center justify-between px-3 py-1.5 text-xs transition-colors hover:bg-gray-50 ${
                    locale === l.code ? 'font-semibold text-navy-700' : 'text-gray-600'
                  }`}
                >
                  <span>{l.label}</span>
                  <span className="text-[10px] text-gray-400">{LOCALE_LABELS[l.code]}</span>
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
          <p className="text-sm leading-relaxed text-gray-300">
            {t(locale, 'brandSubtitle')}
          </p>

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

        <div className="relative z-10 text-xs text-gray-400">
          {t(locale, 'copyright')}
        </div>
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
              className={`flex items-center justify-center gap-2 rounded-xl border p-3 text-sm font-medium transition-all ${
                role === 'client'
                  ? 'border-navy-600 bg-navy-50 text-navy-700 shadow-sm'
                  : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
              }`}
            >
              <div className={`h-2 w-2 rounded-full ${role === 'client' ? 'bg-navy-600' : 'bg-transparent'}`} />
              {t(locale, 'imAClient')}
            </button>
            <button
              onClick={() => setRole('contractor')}
              className={`flex items-center justify-center gap-2 rounded-xl border p-3 text-sm font-medium transition-all ${
                role === 'contractor'
                  ? 'border-navy-600 bg-navy-50 text-navy-700 shadow-sm'
                  : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
              }`}
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
              className={`flex-1 rounded-lg border py-2 text-sm font-medium transition-colors ${
                method === 'phone' ? 'border-navy-600 bg-navy-50 text-navy-700' : 'border-gray-200 text-gray-500'
              }`}
            >
              {t(locale, 'phonePin')}
            </button>
            <button
              onClick={() => setMethod('email')}
              className={`flex-1 rounded-lg border py-2 text-sm font-medium transition-colors ${
                method === 'email' ? 'border-navy-600 bg-navy-50 text-navy-700' : 'border-gray-200 text-gray-500'
              }`}
            >
              {t(locale, 'email')}
            </button>
          </div>

          {/* Form Content */}
          <div className="mt-5 space-y-3">
            {/* === PHONE METHOD === */}
            {method === 'phone' && (
              <>
                {/* STEP 1: Phone input & Name (if signup) */}
                {phoneStep === 'input' && (
                  <>
                    {mode === 'signup' && (
                      <div>
                        <div className={`flex items-center gap-2 rounded-lg border px-3 py-3 ${nameError ? 'border-red-400' : 'border-gray-200 focus-within:border-navy-400'}`}>
                          <input
                            type="text"
                            placeholder={t(locale, 'fullName')}
                            value={name}
                            onChange={(e) => { setName(e.target.value); clearFieldError('name'); }}
                            className="w-full bg-transparent text-sm text-navy-700 placeholder-gray-300 outline-none"
                          />
                        </div>
                        {nameError && <p className="mt-1 text-xs text-red-500">{nameError}</p>}
                      </div>
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
                        autoFocus
                        onChange={(e) => { setPin(e.target.value.replace(/\D/g, '').slice(0, 6)); clearFieldError('pin'); }}
                        className="w-full bg-transparent text-sm font-mono tracking-widest text-navy-700 placeholder-gray-300 outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPin(!showPin)}
                        className="text-gray-400 hover:text-navy-600"
                        tabIndex={-1}
                      >
                        {showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {pinError && <p className="text-xs text-red-500">{pinError}</p>}
                  </div>
                )}

                {/* STEP 2: Create PIN (Phone Signup) */}
                {phoneStep === 'create-pin' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-gray-600">
                        Set your 6-digit security PIN
                      </p>
                      <button
                        type="button"
                        onClick={() => { setPhoneStep('input'); setPin(''); setConfirmPin(''); setPinError(''); setConfirmPinError(''); }}
                        className="text-xs text-navy-600 hover:underline"
                      >
                        ← {t(locale, 'backBtn')}
                      </button>
                    </div>

                    {/* Create PIN */}
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
                          autoFocus
                          onChange={(e) => { setPin(e.target.value.replace(/\D/g, '').slice(0, 6)); clearFieldError('pin'); }}
                          className="w-full bg-transparent text-sm font-mono tracking-widest text-navy-700 placeholder-gray-300 outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPin(!showPin)}
                          className="text-gray-400 hover:text-navy-600"
                          tabIndex={-1}
                        >
                          {showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      {pinError && <p className="mt-1 text-xs text-red-500">{pinError}</p>}
                    </div>

                    {/* Confirm PIN */}
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
                      <p className="text-xs font-semibold text-amber-700">
                        {t(locale, 'errSetupPinFirst')}
                      </p>
                      <button
                        type="button"
                        onClick={() => { setPhoneStep('input'); setPin(''); setConfirmPin(''); setPinError(''); setConfirmPinError(''); }}
                        className="text-xs text-navy-600 hover:underline"
                      >
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
                          autoFocus
                          onChange={(e) => { setPin(e.target.value.replace(/\D/g, '').slice(0, 6)); clearFieldError('pin'); }}
                          className="w-full bg-transparent text-sm font-mono tracking-widest text-navy-700 placeholder-gray-300 outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPin(!showPin)}
                          className="text-gray-400 hover:text-navy-600"
                          tabIndex={-1}
                        >
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
                      placeholder={t(locale, 'password')}
                      value={password}
                      onChange={(e) => { setPassword(e.target.value); clearFieldError('password'); }}
                      className="w-full bg-transparent text-sm text-navy-700 placeholder-gray-300 outline-none"
                    />
                  </div>
                  {passwordError && <p className="mt-1 text-xs text-red-500">{passwordError}</p>}
                </div>

                {mode === 'login' && (
                  <div className="flex justify-end">
                    <button
                      onClick={handleForgotPassword}
                      className="text-xs font-medium text-navy-500 hover:text-navy-700"
                    >
                      {t(locale, 'forgotPassword')}
                    </button>
                  </div>
                )}

                {mode === 'signup' && (
                  <div>
                    <div className={`flex items-center gap-2 rounded-lg border px-3 py-3 ${confirmPasswordError ? 'border-red-400' : 'border-gray-200 focus-within:border-navy-400'}`}>
                      <Lock className="h-4 w-4 text-gray-400" />
                      <input
                        type="password"
                        placeholder={t(locale, 'reEnterPassword')}
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
            disabled={loading}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-amber-400 py-3 text-sm font-semibold text-navy-700 transition-colors hover:bg-amber-300 disabled:opacity-60"
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
                  {t(locale, 'continueWithGoogle')}
                </button>
                <button
                  onClick={() => handleSocialClick('facebook')}
                  className="flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium text-white transition-colors hover:opacity-90"
                  style={{ backgroundColor: '#1877F2' }}
                >
                  <FacebookIcon />
                  {t(locale, 'continueWithFacebook')}
                </button>
              </div>
            </>
          )}

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

                {/* Pointing hand animation for unauthenticated / duplicate users */}
                {showPointingHand && (
                  <span className="pointer-events-none absolute left-full top-1/2 flex -translate-y-1/2 items-center pl-2 whitespace-nowrap">
                    <span className="text-xs font-bold text-amber-600 mr-1">
                      {mode === 'login' ? 'Sign up here' : 'Log in here'}
                    </span>
                    <span
                      className="text-lg inline-block"
                      style={{
                        animation: 'pointHandBounce 0.8s ease-in-out infinite',
                      }}
                    >
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
                <h3 className="mb-4 text-center text-lg font-semibold text-navy-700">{t(locale, 'signInWithGoogle')}</h3>

                <p className="mb-2 text-sm text-gray-500">{t(locale, 'chooseAccount')}</p>

                <button
                  onClick={() => handleSocialAccountSelect('arjun@gmail.com')}
                  className="flex w-full items-center gap-3 rounded-lg p-3 text-left hover:bg-gray-50"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-100 font-semibold text-amber-700">A</div>
                  <div>
                    <p className="text-sm font-medium text-navy-700">Arjun Sharma</p>
                    <p className="text-xs text-gray-400">arjun@gmail.com</p>
                  </div>
                </button>

                <button
                  onClick={() => handleSocialAccountSelect('priya@gmail.com')}
                  className="flex w-full items-center gap-3 rounded-lg p-3 text-left hover:bg-gray-50"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 font-semibold text-blue-700">P</div>
                  <div>
                    <p className="text-sm font-medium text-navy-700">Priya Patel</p>
                    <p className="text-xs text-gray-400">priya@gmail.com</p>
                  </div>
                </button>

                <div className="mt-3 border-t pt-3">
                  <p className="mb-2 text-xs text-gray-400">{t(locale, 'orUseAnotherEmail')}</p>
                  <div className="flex gap-2">
                    <input
                      type="email"
                      placeholder={t(locale, 'enterYourEmail')}
                      value={socialModalEmail}
                      onChange={(e) => setSocialModalEmail(e.target.value)}
                      className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-navy-400"
                    />
                    <button
                      onClick={() => socialModalEmail && handleSocialAccountSelect(socialModalEmail)}
                      className="rounded-lg bg-navy-600 px-4 py-2 text-sm font-medium text-white hover:bg-navy-700"
                    >
                      {t(locale, 'continueBtn')}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="mb-4 flex justify-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full" style={{ backgroundColor: '#1877F2' }}>
                    <FacebookIcon />
                  </div>
                </div>
                <h3 className="mb-4 text-center text-lg font-semibold text-navy-700">Continue with Facebook</h3>

                <button
                  onClick={() => handleSocialAccountSelect('arjun.facebook@gmail.com')}
                  className="flex w-full items-center justify-center gap-2 rounded-lg py-3 text-sm font-semibold text-white"
                  style={{ backgroundColor: '#1877F2' }}
                >
                  {t(locale, 'continueAs')} Arjun
                </button>

                <div className="mt-3 border-t pt-3">
                  <p className="mb-2 text-xs text-gray-400">{t(locale, 'orUseAnotherEmail')}</p>
                  <div className="flex gap-2">
                    <input
                      type="email"
                      placeholder={t(locale, 'enterYourEmail')}
                      value={socialModalEmail}
                      onChange={(e) => setSocialModalEmail(e.target.value)}
                      className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-navy-400"
                    />
                    <button
                      onClick={() => socialModalEmail && handleSocialAccountSelect(socialModalEmail)}
                      className="rounded-lg bg-navy-600 px-4 py-2 text-sm font-medium text-white hover:bg-navy-700"
                    >
                      {t(locale, 'continueBtn')}
                    </button>
                  </div>
                </div>
              </>
            )}

            {socialError && <p className="mt-2 text-xs text-red-500">{socialError}</p>}
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

            {forgotSuccess ? (
              <div className="py-4 text-center">
                <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
                <p className="mt-3 text-sm font-semibold text-navy-700">{forgotSuccess}</p>
              </div>
            ) : (
              <>
                <h3 className="text-lg font-bold text-navy-700">{t(locale, 'resetPassword')}</h3>

                {forgotStep === 1 && (
                  <div className="mt-4 space-y-3">
                    <p className="text-xs text-gray-500">{t(locale, 'enterEmailForReset')}</p>
                    <div className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2.5">
                      <Mail className="h-4 w-4 text-gray-400" />
                      <input
                        type="email"
                        placeholder={t(locale, 'emailPlaceholder')}
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        className="w-full bg-transparent text-sm text-navy-700 outline-none"
                      />
                    </div>
                    <button
                      onClick={handleSendResetCode}
                      className="w-full rounded-lg bg-amber-400 py-2.5 text-sm font-semibold text-navy-700 hover:bg-amber-300"
                    >
                      {t(locale, 'sendResetCode')}
                    </button>
                  </div>
                )}

                {forgotStep === 2 && (
                  <div className="mt-4 space-y-3">
                    <p className="text-xs text-gray-500">
                      {t(locale, 'resetCodeSentTo').replace('{email}', forgotEmail)}
                    </p>
                    <div className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2.5">
                      <Lock className="h-4 w-4 text-gray-400" />
                      <input
                        type="text"
                        placeholder={t(locale, 'enterSixDigitCode')}
                        value={forgotCodeInput}
                        maxLength={6}
                        onChange={(e) => setForgotCodeInput(e.target.value)}
                        className="w-full bg-transparent text-sm text-navy-700 outline-none"
                      />
                    </div>
                    <button
                      onClick={handleVerifyResetCode}
                      className="w-full rounded-lg bg-amber-400 py-2.5 text-sm font-semibold text-navy-700 hover:bg-amber-300"
                    >
                      {t(locale, 'verifyCode')}
                    </button>
                  </div>
                )}

                {forgotStep === 3 && (
                  <div className="mt-4 space-y-3">
                    <p className="text-xs text-gray-500">{t(locale, 'enterNewPassword')}</p>
                    <div className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2.5">
                      <Lock className="h-4 w-4 text-gray-400" />
                      <input
                        type="password"
                        placeholder={t(locale, 'newPassword')}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full bg-transparent text-sm text-navy-700 outline-none"
                      />
                    </div>
                    <div className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2.5">
                      <Lock className="h-4 w-4 text-gray-400" />
                      <input
                        type="password"
                        placeholder={t(locale, 'confirmNewPassword')}
                        value={confirmNewPassword}
                        onChange={(e) => setConfirmNewPassword(e.target.value)}
                        className="w-full bg-transparent text-sm text-navy-700 outline-none"
                      />
                    </div>
                    <button
                      onClick={handleResetPassword}
                      className="w-full rounded-lg bg-amber-400 py-2.5 text-sm font-semibold text-navy-700 hover:bg-amber-300"
                    >
                      {t(locale, 'resetPassword')}
                    </button>
                  </div>
                )}

                {forgotError && <p className="mt-2 text-xs text-red-500">{forgotError}</p>}

                <button
                  onClick={() => setShowForgotModal(false)}
                  className="mt-3 flex w-full items-center justify-center gap-1 text-xs text-gray-400 hover:text-navy-600"
                >
                  <ArrowLeft className="h-3 w-3" />
                  {t(locale, 'backToLogin')}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}
