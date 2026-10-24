import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Sparkles,
  ShieldCheck,
  FolderOpen,
  Receipt,
  Calendar,
  Compass,
  Mic,
  ArrowRight,
  CheckCircle2,
  Lock,
  EyeOff,
  Cpu
} from 'lucide-react';
import {
  GlassCard,
  GlassButton,
  GlassInput,
  GlassModal
} from '../components/common/GlassComponents';
import { authApi, setAuthToken } from '../services/api';

export interface LandingPageProps {
  initialMode?: 'login' | 'signup';
}

export const LandingPage: React.FC<LandingPageProps> = ({ initialMode }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const isLoginRoute = initialMode === 'login' || location.pathname === '/login';
  const isSignupRoute = initialMode === 'signup' || location.pathname === '/signup';

  const [authModalOpen, setAuthModalOpen] = useState(isLoginRoute || isSignupRoute);
  const [isSignUp, setIsSignUp] = useState(isSignupRoute);
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (location.pathname === '/login') {
      setIsSignUp(false);
      setAuthModalOpen(true);
    } else if (location.pathname === '/signup') {
      setIsSignUp(true);
      setAuthModalOpen(true);
    }
  }, [location.pathname]);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isSignUp) {
        if (!fullName || !email) {
          setError('Please provide your name and email');
          setLoading(false);
          return;
        }
        const res = await authApi.register(fullName, email);
        if (res.token) {
          setAuthToken(res.token);
          // New user goes to onboarding
          navigate('/onboarding');
        }
      } else {
        if (!email) {
          setError('Please enter your email');
          setLoading(false);
          return;
        }
        const res = await authApi.login(email);
        if (res.token) {
          setAuthToken(res.token);
          if (res.user?.onboarding_completed) {
            navigate('/dashboard');
          } else {
            navigate('/onboarding');
          }
        }
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoAccess = async () => {
    setLoading(true);
    try {
      const res = await authApi.login('demo@orbi.internal');
      setAuthToken(res.token);
      navigate('/dashboard');
    } catch (err) {
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070B14] text-slate-100 flex flex-col relative overflow-hidden">
      {/* Background ambient glow highlights */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-indigo-600/10 blur-[140px] pointer-events-none rounded-full" />
      <div className="absolute top-1/3 -right-40 w-[500px] h-[500px] bg-purple-600/10 blur-[160px] pointer-events-none rounded-full" />

      {/* Navigation Header */}
      <header className="relative z-10 max-w-7xl w-full mx-auto px-6 py-6 flex items-center justify-between border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-400 p-[1px] shadow-lg shadow-indigo-600/20">
            <div className="w-full h-full rounded-[11px] bg-[#070B14] flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-indigo-400" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-xl tracking-tight font-['Manrope']">Orbi</span>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-indigo-300 bg-indigo-500/15 px-2 py-0.5 rounded-full border border-indigo-500/30">
                A Digital PA
              </span>
            </div>
            <p className="text-[11px] text-slate-400">One assistant. Everything organized.</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <GlassButton
            variant="ghost"
            size="sm"
            onClick={() => {
              setIsSignUp(false);
              setAuthModalOpen(true);
            }}
          >
            Sign In
          </GlassButton>
          <GlassButton
            variant="primary"
            size="sm"
            onClick={() => {
              setIsSignUp(true);
              setAuthModalOpen(true);
            }}
          >
            Get Started
          </GlassButton>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative z-10 max-w-5xl mx-auto px-6 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-medium mb-8">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Intelligent Personal Assistant for Modern Lives</span>
        </div>

        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-white font-['Manrope'] max-w-4xl mx-auto leading-[1.1]">
          Your life, organized. <br />
          <span className="bg-gradient-to-r from-indigo-300 via-indigo-100 to-slate-300 bg-clip-text text-transparent">
            Your time, yours.
          </span>
        </h1>

        <p className="mt-6 text-base sm:text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed">
          Orbi is your private AI personal assistant that organizes bills, documents, appointments, family events, and multi-step applications. Grounded in your real records, never hallucinations.
        </p>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <GlassButton
            variant="primary"
            size="lg"
            icon={<ArrowRight className="w-4 h-4 ml-1" />}
            onClick={() => {
              setIsSignUp(true);
              setAuthModalOpen(true);
            }}
          >
            Get Started
          </GlassButton>
          <GlassButton
            variant="secondary"
            size="lg"
            onClick={handleDemoAccess}
            loading={loading}
          >
            Explore Dashboard Demo
          </GlassButton>
        </div>

        {/* Brand Promise Badges */}
        <div className="mt-12 flex flex-wrap items-center justify-center gap-6 text-xs text-slate-400">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Zero Third-Party Data Selling</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Lock className="w-4 h-4 text-indigo-400" />
            <span>Encrypted Private Vault</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Cpu className="w-4 h-4 text-purple-400" />
            <span>PyMuPDF Text Extraction</span>
          </div>
        </div>
      </section>

      {/* Dashboard Preview Surface */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 pb-20">
        <div className="relative rounded-3xl p-2 bg-gradient-to-b from-white/10 via-white/5 to-transparent shadow-2xl">
          <div className="rounded-[22px] bg-[#0B1120] border border-white/10 p-6 md:p-8 backdrop-blur-2xl">
            <div className="flex items-center justify-between pb-6 border-b border-white/5">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-rose-500/80" />
                <div className="w-3 h-3 rounded-full bg-amber-500/80" />
                <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
                <span className="text-xs text-slate-500 ml-2 font-mono">orbi.internal/dashboard</span>
              </div>
              <span className="text-xs text-indigo-400 font-medium">Live Briefing Preview</span>
            </div>

            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-5 text-left">
              <GlassCard className="p-5">
                <div className="flex items-center justify-between text-indigo-400 mb-2">
                  <Receipt className="w-5 h-5" />
                  <span className="text-xs font-semibold px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">Due in 3 days</span>
                </div>
                <h4 className="text-sm font-semibold text-slate-200">Electric Utility Bill</h4>
                <p className="text-xs text-slate-400 mt-1">₹1,425.00 • Extracted from PDF</p>
              </GlassCard>

              <GlassCard className="p-5 border-indigo-500/30 bg-indigo-950/20">
                <div className="flex items-center justify-between text-indigo-400 mb-2">
                  <Compass className="w-5 h-5" />
                  <span className="text-xs font-semibold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">Signature Feature</span>
                </div>
                <h4 className="text-sm font-semibold text-slate-200">Schengen Visa Companion</h4>
                <div className="w-full bg-slate-800 rounded-full h-1.5 mt-2">
                  <div className="bg-indigo-500 h-1.5 rounded-full w-3/5" />
                </div>
                <p className="text-[11px] text-slate-400 mt-2">3 of 5 steps completed</p>
              </GlassCard>

              <GlassCard className="p-5">
                <div className="flex items-center justify-between text-indigo-400 mb-2">
                  <Calendar className="w-5 h-5" />
                  <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">Next Week</span>
                </div>
                <h4 className="text-sm font-semibold text-slate-200">Theo's Birthday 🎂</h4>
                <p className="text-xs text-slate-400 mt-1">Family milestone reminder scheduled</p>
              </GlassCard>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Capabilities Grid */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 py-16">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-3xl font-bold tracking-tight text-white font-['Manrope']">
            Designed for what matters most
          </h2>
          <p className="text-sm text-slate-400 mt-3 leading-relaxed">
            Eliminate mental clutter. Orbi acts as your proactive personal executive assistant, tracking deadlines, organizing paperwork, and guiding complex tasks.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <GlassCard className="p-6">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mb-4">
              <FolderOpen className="w-5 h-5" />
            </div>
            <h3 className="text-base font-semibold text-slate-200">Smart Memory</h3>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              Upload any PDF bill, lease, or application notice. PyMuPDF extracts dates, amounts, and organizations automatically with verifiable source snippets.
            </p>
          </GlassCard>

          <GlassCard className="p-6 border-indigo-500/30">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-300 mb-4">
              <Compass className="w-5 h-5" />
            </div>
            <h3 className="text-base font-semibold text-slate-200">Application Companion</h3>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              Orbi breaks down visas, university admissions, and mortgages into verified ordered checklists, cross-referencing your stored documents.
            </p>
          </GlassCard>

          <GlassCard className="p-6">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mb-4">
              <Receipt className="w-5 h-5" />
            </div>
            <h3 className="text-base font-semibold text-slate-200">Proactive Bill Tracking</h3>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              Never miss a utility or renewal. Advance persistent reminders notify you ahead of due dates without claiming fake financial executions.
            </p>
          </GlassCard>

          <GlassCard className="p-6">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mb-4">
              <Calendar className="w-5 h-5" />
            </div>
            <h3 className="text-base font-semibold text-slate-200">Family & Milestones</h3>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              Track birthdays, anniversaries, and family schedules in one unified calendar with configurable advance notifications.
            </p>
          </GlassCard>

          <GlassCard className="p-6">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mb-4">
              <Mic className="w-5 h-5" />
            </div>
            <h3 className="text-base font-semibold text-slate-200">Conversational Voice PA</h3>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              Speak naturally to Orbi. Web Speech API allows voice queries and answers read aloud, referencing only your authentic records.
            </p>
          </GlassCard>

          <GlassCard className="p-6">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mb-4">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="text-base font-semibold text-slate-200">Privacy Safeguards</h3>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              Strict user isolation, private PDF storage, and transparent Row Level Security. Your data remains strictly yours.
            </p>
          </GlassCard>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/5 py-10 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-400" />
            <span className="font-semibold text-slate-300">Orbi — A Digital PA</span>
          </div>
          <p>© 2026 Orbi Technologies. One assistant. Everything organized.</p>
        </div>
      </footer>

      {/* Authentication Modal */}
      <GlassModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        title={isSignUp ? "Create your Orbi Account" : "Sign in to Orbi"}
        description={isSignUp ? "Step into organized living with your private digital assistant." : "Enter your email to open your executive dashboard."}
      >
        <form onSubmit={handleAuthSubmit} className="space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
              {error}
            </div>
          )}

          {isSignUp && (
            <GlassInput
              label="Full Name"
              placeholder="e.g. Eleanor Vance"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          )}

          <GlassInput
            label="Email Address"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <div className="pt-2">
            <GlassButton
              type="submit"
              variant="primary"
              className="w-full"
              loading={loading}
            >
              {isSignUp ? "Continue to Personal Onboarding" : "Sign In"}
            </GlassButton>
          </div>

          <div className="text-center pt-2">
            <button
              type="button"
              onClick={() => {
                setError('');
                setIsSignUp(!isSignUp);
              }}
              className="text-xs text-slate-400 hover:text-indigo-300 transition-colors"
            >
              {isSignUp ? "Already have an account? Sign In" : "Need an account? Get Started"}
            </button>
          </div>
        </form>
      </GlassModal>
    </div>
  );
};
