import React, { useState } from 'react';
import { Socket } from 'socket.io-client';
import {
  ShieldCheck,
  User,
  Lock,
  HelpCircle,
  Eye,
  EyeOff,
  Key,
  CheckCircle,
  ArrowRight,
  Sparkles,
  AlertCircle,
  RefreshCw,
  LogIn,
  UserPlus,
  Info,
  Heart,
  Smartphone,
  Download,
} from 'lucide-react';
import { User as UserType } from '../types';
import { KeyPairPem } from '../crypto/e2ee';

interface OnboardingModalProps {
  socket: Socket | null;
  onAuthSuccess: (user: UserType) => void;
  isGeneratingKey: boolean;
  generatedFingerprint?: string;
  generatedPem?: KeyPairPem;
  onOpenAbout?: () => void;
  onOpenAndroidInstall?: () => void;
}


const PRESET_SECURITY_QUESTIONS = [
  "What was the name of your first pet?",
  "What is your mother's maiden name?",
  "What city were you born in?",
  "What was your high school mascot?",
  "What is the name of your favorite teacher?",
  "What was your childhood nickname?",
  "Custom Security Question..."
];

const AVATAR_SEEDS = ['CyberNova', 'AlexDev', 'SophiaKey', 'Zenith', 'EchoVibe', 'AstroMind', 'QuantumX', 'PixelArt'];

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  socket,
  onAuthSuccess,
  isGeneratingKey,
  generatedFingerprint,
  generatedPem,
  onOpenAbout,
  onOpenAndroidInstall,
}) => {
  const [mode, setMode] = useState<'login' | 'register' | 'forgot_password'>('login');

  // Shared / Login state
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Registration state
  const [regUsername, setRegUsername] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [selectedQuestion, setSelectedQuestion] = useState(PRESET_SECURITY_QUESTIONS[0]);
  const [customQuestion, setCustomQuestion] = useState('');
  const [securityAnswer, setSecurityAnswer] = useState('');
  const [selectedSeed, setSelectedSeed] = useState(AVATAR_SEEDS[0]);
  const [statusText, setStatusText] = useState('Available for end-to-end encrypted chat 🔒');
  const [bio, setBio] = useState('Passionate about privacy & security.');

  // Forgot password state
  const [forgotUsername, setForgotUsername] = useState('');
  const [fetchedQuestion, setFetchedQuestion] = useState('');
  const [forgotAnswer, setForgotAnswer] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [forgotStep, setForgotStep] = useState<1 | 2>(1);

  // Status & Feedback
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const avatarUrl = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(selectedSeed || regUsername || 'default')}`;

  const handleModeChange = (newMode: 'login' | 'register' | 'forgot_password') => {
    setMode(newMode);
    setError('');
    setSuccessMsg('');
  };

  // 1. Handle Account Login
  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    const cleanName = loginUsername.trim();
    if (!cleanName) {
      setError('Please enter your username');
      return;
    }
    if (!loginPassword) {
      setError('Please enter your password');
      return;
    }
    if (!socket || !socket.connected) {
      setError('Connecting to secure server... Please try again in a moment.');
      return;
    }

    setIsLoading(true);
    socket.emit(
      'auth:login',
      {
        username: cleanName,
        password: loginPassword,
        publicKeyPem: generatedPem?.publicKeyPem,
        keyFingerprint: generatedPem?.fingerprint,
      },
      (res: { success: boolean; user?: UserType; error?: string }) => {
        setIsLoading(false);
        if (res.success && res.user) {
          onAuthSuccess(res.user);
        } else {
          setError(res.error || 'Login failed. Please check credentials.');
        }
      }
    );
  };

  // 2. Handle Account Registration
  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    const cleanName = regUsername.trim().replace(/[^a-zA-Z0-9_-]/g, '');
    if (!cleanName || cleanName.length < 3) {
      setError('Username must be at least 3 characters (letters, numbers, _, -)');
      return;
    }
    if (!regPassword || regPassword.length < 4) {
      setError('Password must be at least 4 characters long');
      return;
    }
    if (regPassword !== regConfirmPassword) {
      setError('Passwords do not match');
      return;
    }

    const finalQuestion = selectedQuestion === 'Custom Security Question...' ? customQuestion.trim() : selectedQuestion;
    if (!finalQuestion) {
      setError('Please enter or select a security question');
      return;
    }
    if (!securityAnswer.trim()) {
      setError('Please provide an answer to your security question');
      return;
    }

    if (!socket || !socket.connected) {
      setError('Connecting to secure server... Please wait a moment.');
      return;
    }

    setIsLoading(true);
    socket.emit(
      'auth:register',
      {
        username: cleanName,
        password: regPassword,
        securityQuestion: finalQuestion,
        securityAnswer: securityAnswer.trim(),
        avatarUrl,
        statusText,
        bio,
        publicKeyPem: generatedPem?.publicKeyPem,
        keyFingerprint: generatedPem?.fingerprint,
      },
      (res: { success: boolean; user?: UserType; error?: string }) => {
        setIsLoading(false);
        if (res.success && res.user) {
          onAuthSuccess(res.user);
        } else {
          setError(res.error || 'Registration failed. Please try again.');
        }
      }
    );
  };

  // 3a. Handle Forgot Password Step 1: Fetch Question
  const handleFetchSecurityQuestion = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    const cleanName = forgotUsername.trim();
    if (!cleanName) {
      setError('Please enter your username');
      return;
    }

    if (!socket || !socket.connected) {
      setError('Server connecting... Please try again.');
      return;
    }

    setIsLoading(true);
    socket.emit(
      'auth:get_security_question',
      cleanName,
      (res: { success: boolean; username?: string; securityQuestion?: string; error?: string }) => {
        setIsLoading(false);
        if (res.success && res.securityQuestion) {
          setFetchedQuestion(res.securityQuestion);
          setForgotStep(2);
        } else {
          setError(res.error || 'Username not found.');
        }
      }
    );
  };

  // 3b. Handle Forgot Password Step 2: Reset Password
  const handleResetPasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!forgotAnswer.trim()) {
      setError('Please answer your security question');
      return;
    }
    if (!newPassword || newPassword.length < 4) {
      setError('New password must be at least 4 characters long');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setError('New passwords do not match');
      return;
    }

    if (!socket || !socket.connected) {
      setError('Server connection error.');
      return;
    }

    setIsLoading(true);
    socket.emit(
      'auth:reset_password',
      {
        username: forgotUsername.trim(),
        securityAnswer: forgotAnswer.trim(),
        newPassword,
      },
      (res: { success: boolean; message?: string; error?: string }) => {
        setIsLoading(false);
        if (res.success) {
          setSuccessMsg(res.message || 'Password reset successfully! Please log in.');
          setLoginUsername(forgotUsername.trim());
          setLoginPassword('');
          setForgotStep(1);
          setForgotAnswer('');
          setNewPassword('');
          setConfirmNewPassword('');
          setTimeout(() => setMode('login'), 1500);
        } else {
          setError(res.error || 'Failed to reset password.');
        }
      }
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-4 animate-in fade-in duration-300">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
        {/* Banner Header */}
        <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 p-5 text-white text-center relative flex-shrink-0">
          <div className="mx-auto w-12 h-12 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center mb-2 shadow-inner">
            <ShieldCheck className="w-7 h-7 text-emerald-200" />
          </div>
          <h2 className="text-xl font-bold tracking-tight">Batchit E2EE</h2>
          <p className="text-[11px] text-emerald-100/90 mt-0.5">
            Zero-Trust Encrypted Messaging Network
          </p>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-950/50 flex-shrink-0">
          <button
            type="button"
            onClick={() => handleModeChange('login')}
            className={`flex-1 py-3 text-xs font-semibold flex items-center justify-center gap-1.5 transition border-b-2 ${
              mode === 'login'
                ? 'border-emerald-500 text-emerald-400 bg-slate-900/50'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Log In</span>
          </button>
          <button
            type="button"
            onClick={() => handleModeChange('register')}
            className={`flex-1 py-3 text-xs font-semibold flex items-center justify-center gap-1.5 transition border-b-2 ${
              mode === 'register'
                ? 'border-emerald-500 text-emerald-400 bg-slate-900/50'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Create Account</span>
          </button>
        </div>

        {/* Modal Body Container with Scroll */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {error && (
            <div className="p-3 text-xs bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl flex items-start gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 text-xs bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl flex items-start gap-2 animate-in fade-in">
              <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* ================= MODE 1: LOG IN ================= */}
          {mode === 'login' && (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Username *
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
                    <User className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    required
                    value={loginUsername}
                    onChange={(e) => setLoginUsername(e.target.value)}
                    placeholder="Enter your username"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-slate-100 text-sm rounded-xl outline-none transition"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Password *
                  </label>
                  <button
                    type="button"
                    onClick={() => handleModeChange('forgot_password')}
                    className="text-[11px] text-emerald-400 hover:underline"
                  >
                    Forgot Password?
                  </button>
                </div>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
                    <Lock className="w-4 h-4" />
                  </span>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full pl-10 pr-10 py-2.5 bg-slate-950 border border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-slate-100 text-sm rounded-xl outline-none transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-200"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* RSA Keypair Indicator */}
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 flex items-start gap-3 text-xs">
                <Key className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="font-semibold text-slate-200 flex items-center gap-1.5">
                    <span>E2EE RSA Key Identity</span>
                    {isGeneratingKey ? (
                      <span className="text-[10px] text-amber-400 animate-pulse">Generating...</span>
                    ) : (
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                    )}
                  </div>
                  {generatedFingerprint && (
                    <div className="mt-1 font-mono text-[10px] text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-900/50 inline-block">
                      Fingerprint: {generatedFingerprint}
                    </div>
                  )}
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading || isGeneratingKey}
                className="w-full py-3 px-4 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-semibold rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Logging in...</span>
                  </>
                ) : (
                  <>
                    <span>Log In to Account</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <div className="text-center pt-2">
                <p className="text-xs text-slate-400">
                  Don't have an account?{' '}
                  <button
                    type="button"
                    onClick={() => handleModeChange('register')}
                    className="text-emerald-400 font-semibold hover:underline"
                  >
                    Register now
                  </button>
                </p>
              </div>
            </form>
          )}

          {/* ================= MODE 2: CREATE ACCOUNT ================= */}
          {mode === 'register' && (
            <form onSubmit={handleRegisterSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Choose Username *
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 font-mono text-sm">
                    @
                  </span>
                  <input
                    type="text"
                    required
                    value={regUsername}
                    onChange={(e) => {
                      setRegUsername(e.target.value);
                      setSelectedSeed(e.target.value);
                    }}
                    placeholder="e.g. alex_cipher"
                    className="w-full pl-8 pr-4 py-2.5 bg-slate-950 border border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-slate-100 text-sm rounded-xl outline-none transition"
                  />
                </div>
              </div>

              {/* Password Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Password *
                  </label>
                  <input
                    type="password"
                    required
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="Min 4 chars"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 focus:border-emerald-500 text-slate-100 text-xs rounded-xl outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Confirm Password *
                  </label>
                  <input
                    type="password"
                    required
                    value={regConfirmPassword}
                    onChange={(e) => setRegConfirmPassword(e.target.value)}
                    placeholder="Re-enter password"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 focus:border-emerald-500 text-slate-100 text-xs rounded-xl outline-none"
                  />
                </div>
              </div>

              {/* Security Questions Section */}
              <div className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-xl space-y-2.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-400">
                  <HelpCircle className="w-4 h-4" />
                  <span>Password Recovery Questions *</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-snug">
                  If you ever forget your password, you can recover your account using this security answer.
                </p>

                <div>
                  <label className="block text-[11px] text-slate-300 mb-1">Select Security Question</label>
                  <select
                    value={selectedQuestion}
                    onChange={(e) => setSelectedQuestion(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 text-slate-200 text-xs rounded-lg outline-none focus:border-emerald-500"
                  >
                    {PRESET_SECURITY_QUESTIONS.map((q) => (
                      <option key={q} value={q}>
                        {q}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedQuestion === 'Custom Security Question...' && (
                  <div>
                    <label className="block text-[11px] text-slate-300 mb-1">Type Custom Question</label>
                    <input
                      type="text"
                      required
                      value={customQuestion}
                      onChange={(e) => setCustomQuestion(e.target.value)}
                      placeholder="e.g. What was my first car model?"
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 text-slate-200 text-xs rounded-lg outline-none focus:border-emerald-500"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-[11px] text-slate-300 mb-1">Your Security Answer</label>
                  <input
                    type="text"
                    required
                    value={securityAnswer}
                    onChange={(e) => setSecurityAnswer(e.target.value)}
                    placeholder="Enter answer (case-insensitive)"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 text-slate-200 text-xs rounded-lg outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Avatar Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Select Avatar Persona
                </label>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full border-2 border-emerald-500/50 bg-slate-950 p-1 flex-shrink-0">
                    <img src={avatarUrl} alt="Avatar" className="w-full h-full rounded-full object-cover" />
                  </div>
                  <div className="flex-1 overflow-x-auto pb-1 flex gap-2 no-scrollbar">
                    {AVATAR_SEEDS.map((seed) => (
                      <button
                        key={seed}
                        type="button"
                        onClick={() => setSelectedSeed(seed)}
                        className={`p-1 rounded-lg border text-xs flex-shrink-0 transition ${
                          selectedSeed === seed
                            ? 'border-emerald-500 bg-emerald-500/10 text-emerald-300'
                            : 'border-slate-800 bg-slate-950 text-slate-400'
                        }`}
                      >
                        <img
                          src={`https://api.dicebear.com/7.x/bottts/svg?seed=${seed}`}
                          alt={seed}
                          className="w-6 h-6 rounded-full"
                        />
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Status & Bio */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Status Message</label>
                  <input
                    type="text"
                    value={statusText}
                    onChange={(e) => setStatusText(e.target.value)}
                    className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-xl outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Short Bio</label>
                  <input
                    type="text"
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-xl outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading || isGeneratingKey}
                className="w-full py-3 px-4 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-semibold rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Creating Account...</span>
                  </>
                ) : (
                  <>
                    <span>Create Account & Save</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <div className="text-center pt-1">
                <p className="text-xs text-slate-400">
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => handleModeChange('login')}
                    className="text-emerald-400 font-semibold hover:underline"
                  >
                    Log In
                  </button>
                </p>
              </div>
            </form>
          )}

          {/* ================= MODE 3: FORGOT PASSWORD ================= */}
          {mode === 'forgot_password' && (
            <div className="space-y-4">
              <div className="text-center">
                <h3 className="text-sm font-bold text-slate-200">Account Recovery</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Answer your registered security question to set a new password.
                </p>
              </div>

              {forgotStep === 1 && (
                <form onSubmit={handleFetchSecurityQuestion} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                      Enter Account Username
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
                        <User className="w-4 h-4" />
                      </span>
                      <input
                        type="text"
                        required
                        value={forgotUsername}
                        onChange={(e) => setForgotUsername(e.target.value)}
                        placeholder="Your registered username"
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 focus:border-emerald-500 text-slate-100 text-sm rounded-xl outline-none"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-2.5 px-4 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-semibold rounded-xl transition flex items-center justify-center gap-2"
                  >
                    {isLoading ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <span>Find Security Question</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>
              )}

              {forgotStep === 2 && (
                <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
                  <div className="p-3 bg-slate-950/80 border border-amber-500/30 rounded-xl space-y-1">
                    <div className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider flex items-center gap-1">
                      <HelpCircle className="w-3.5 h-3.5" />
                      <span>Security Question for @{forgotUsername}</span>
                    </div>
                    <p className="text-xs text-slate-200 font-medium">{fetchedQuestion}</p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                      Security Answer *
                    </label>
                    <input
                      type="text"
                      required
                      value={forgotAnswer}
                      onChange={(e) => setForgotAnswer(e.target.value)}
                      placeholder="Enter your security answer"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 focus:border-emerald-500 text-slate-100 text-xs rounded-xl outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                        New Password *
                      </label>
                      <input
                        type="password"
                        required
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Min 4 chars"
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 focus:border-emerald-500 text-slate-100 text-xs rounded-xl outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                        Confirm New Password *
                      </label>
                      <input
                        type="password"
                        required
                        value={confirmNewPassword}
                        onChange={(e) => setConfirmNewPassword(e.target.value)}
                        placeholder="Re-enter password"
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 focus:border-emerald-500 text-slate-100 text-xs rounded-xl outline-none"
                      />
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setForgotStep(1)}
                      className="py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-xl transition"
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="flex-1 py-2.5 px-4 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-semibold text-xs rounded-xl transition flex items-center justify-center gap-2"
                    >
                      {isLoading ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <span>Reset Password & Save</span>
                      )}
                    </button>
                  </div>
                </form>
              )}

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => handleModeChange('login')}
                  className="text-xs text-slate-400 hover:text-slate-200 underline"
                >
                  Return to Log In
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Info */}
        <div className="px-5 py-3 border-t border-slate-800/80 bg-slate-950/90 flex items-center justify-between text-[11px] text-slate-400 flex-shrink-0">
          <div className="flex items-center gap-1.5">
            <span>Made with</span>
            <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />
            <span>in India 🇮🇳</span>
          </div>
          <div className="flex items-center gap-3">
            {onOpenAndroidInstall && (
              <button
                type="button"
                onClick={onOpenAndroidInstall}
                className="text-emerald-400 font-semibold hover:text-emerald-300 flex items-center gap-1 bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-500/20 transition"
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>Android App / APK</span>
              </button>
            )}
            {onOpenAbout && (
              <button
                type="button"
                onClick={onOpenAbout}
                className="text-slate-300 font-semibold hover:text-white flex items-center gap-1"
              >
                <Info className="w-3.5 h-3.5" />
                <span>About</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
