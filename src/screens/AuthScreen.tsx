import { useState } from 'react';
import { Phone, Mail, Lock, ChevronDown, ArrowRight, CheckCircle2 } from 'lucide-react';
import type { Role } from '../types';
import { Logo } from '../components/ui';

export function AuthScreen({ onAuth, defaultRole = 'client' }: { onAuth: (role: Role) => void; defaultRole?: Role }) {
  const [role, setRole] = useState<Role>(defaultRole);
  const [method, setMethod] = useState<'phone' | 'email'>('phone');
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [language, setLanguage] = useState('EN');
  const [langOpen, setLangOpen] = useState(false);

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
        <p className="text-sm text-white">© 2026 SmartBuild. All rights reserved.</p>
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
            {method === 'phone' ? (
              <div className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-3 focus-within:border-navy-400">
                <Phone className="h-4 w-4 text-gray-400" />
                <span className="text-sm text-gray-500">+91</span>
                <input
                  type="tel"
                  placeholder="98765 43210"
                  className="w-full bg-transparent text-sm text-navy-700 placeholder-gray-300 outline-none"
                />
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-3 focus-within:border-navy-400">
                <Mail className="h-4 w-4 text-gray-400" />
                <input
                  type="email"
                  placeholder="you@example.com"
                  className="w-full bg-transparent text-sm text-navy-700 placeholder-gray-300 outline-none"
                />
              </div>
            )}

            {method === 'email' && (
              <div className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-3 focus-within:border-navy-400">
                <Lock className="h-4 w-4 text-gray-400" />
                <input
                  type="password"
                  placeholder="Password"
                  className="w-full bg-transparent text-sm text-navy-700 placeholder-gray-300 outline-none"
                />
              </div>
            )}

            {method === 'phone' && mode === 'signup' && (
              <div className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-3 focus-within:border-navy-400">
                <Lock className="h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Enter 6-digit OTP"
                  className="w-full bg-transparent text-sm text-navy-700 placeholder-gray-300 outline-none"
                />
                <button className="text-xs font-medium text-navy-500 hover:text-navy-700">Send OTP</button>
              </div>
            )}
          </div>

          <button
            onClick={() => onAuth(role)}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-amber-400 py-3 text-sm font-semibold text-navy-700 transition-colors hover:bg-amber-300"
          >
            {mode === 'login' ? 'Log In' : 'Sign Up'}
            <ArrowRight className="h-4 w-4" />
          </button>

          <p className="mt-5 text-center text-sm text-gray-500">
            {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
            <button
              onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
              className="font-semibold text-navy-600 hover:text-navy-700"
            >
              {mode === 'login' ? 'Sign up' : 'Log in'}
            </button>
          </p>

          <button
            onClick={() => onAuth('admin')}
            className="mt-4 w-full text-center text-xs text-gray-400 hover:text-navy-500"
          >
            Admin portal →
          </button>
        </div>
      </div>
    </div>
  );
}
