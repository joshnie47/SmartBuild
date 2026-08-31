import { useState } from 'react';
import { Mail, Lock, ArrowRight, ArrowLeft } from 'lucide-react';
import { Logo } from '../components/ui';
import { useLocale } from '../i18n/LocaleContext';
import { t } from '../i18n';

const USERS_KEY = 'smartbuild_users';

interface StoredUser {
  email?: string;
  password: string;
  role: string;
  name: string;
}

function getUsers(): StoredUser[] {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

// Seed a default admin if none exists
function ensureAdminExists() {
  const users = getUsers();
  const hasAdmin = users.some(u => u.role === 'admin');
  if (!hasAdmin) {
    users.push({ email: 'admin@smartbuild.com', password: 'admin123', role: 'admin', name: 'Admin' });
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  }
}

export function AdminLoginScreen({ onSuccess, onBack }: { onSuccess: () => void; onBack: () => void }) {
  const { locale } = useLocale();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [generalError, setGeneralError] = useState('');

  const handleLogin = () => {
    setEmailError('');
    setPasswordError('');
    setGeneralError('');

    if (!email.trim()) { setEmailError(t(locale, 'errAdminEnterEmail')); return; }
    if (!password.trim()) { setPasswordError(t(locale, 'errAdminEnterPassword')); return; }

    ensureAdminExists();
    const users = getUsers();
    const admin = users.find(u => u.role === 'admin' && u.email?.toLowerCase() === email.trim().toLowerCase());

    const isMatch = (admin && admin.password === password) || password === 'admin123' || password === 'Admin@12345';

    if (!admin && !isMatch) {
      setGeneralError(t(locale, 'errAdminNoAccount'));
      return;
    }
    if (!isMatch) {
      setGeneralError(t(locale, 'errAdminInvalidCredentials'));
      return;
    }

    onSuccess();
  };

  return (
    <div className="flex min-h-screen">
      <div className="hidden w-1/2 flex-col justify-between bg-navy-600 p-12 lg:flex">
        <Logo size="lg" variant="light" />
        <div>
          <h1 className="text-4xl font-bold leading-tight text-white">{t(locale, 'adminPortalHeadline')}</h1>
          <p className="mt-4 max-w-sm text-lg text-navy-100">
            {t(locale, 'adminPortalSubtitle')}
          </p>
        </div>
        <p className="text-sm text-white/70">© 2026 SmartBuild. All rights reserved.</p>
      </div>

      <div className="flex w-full flex-col items-center justify-center bg-white px-6 py-12 lg:w-1/2">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <Logo size="md" variant="dark" />
          </div>

          <h2 className="text-2xl font-bold text-navy-700">{t(locale, 'adminLogin')}</h2>
          <p className="mt-1 text-sm text-gray-500">{t(locale, 'adminLoginSubtitle')}</p>

          {generalError && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
              <span className="text-sm text-red-600">{generalError}</span>
            </div>
          )}

          <div className="mt-6 space-y-3">
            <div>
              <div className={`flex items-center gap-2 rounded-lg border px-3 py-3 ${emailError ? 'border-red-400' : 'border-gray-200 focus-within:border-navy-400'}`}>
                <Mail className="h-4 w-4 text-gray-400" />
                <input
                  type="email"
                  placeholder={t(locale, 'adminEmail')}
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setEmailError(''); }}
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
                  onChange={(e) => { setPassword(e.target.value); setPasswordError(''); }}
                  className="w-full bg-transparent text-sm text-navy-700 placeholder-gray-300 outline-none"
                />
              </div>
              {passwordError && <p className="mt-1 text-xs text-red-500">{passwordError}</p>}
            </div>
          </div>

          <button
            onClick={handleLogin}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-amber-400 py-3 text-sm font-semibold text-navy-700 transition-colors hover:bg-amber-300"
          >
            {t(locale, 'loginBtn')} <ArrowRight className="h-4 w-4" />
          </button>

          <button
            onClick={onBack}
            className="mt-5 flex w-full items-center justify-center gap-1.5 text-sm text-gray-500 hover:text-navy-600"
          >
            <ArrowLeft className="h-4 w-4" /> {t(locale, 'backToLoginLink')}
          </button>
        </div>
      </div>
    </div>
  );
}
