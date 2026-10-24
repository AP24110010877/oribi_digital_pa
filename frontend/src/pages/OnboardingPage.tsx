import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles,
  User,
  Users,
  Sliders,
  CheckCircle2,
  Plus,
  Trash2,
  ArrowRight,
  ArrowLeft,
  Calendar,
  Globe
} from 'lucide-react';
import {
  GlassCard,
  GlassButton,
  GlassInput
} from '../components/common/GlassComponents';
import { profileApi, authApi } from '../services/api';

const PROFESSIONS = [
  'Working Professional',
  'Student',
  'Business Owner',
  'Freelancer',
  'Actor',
  'Influencer',
  'Homemaker',
  'Other'
];

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Spanish' },
  { code: 'fr', label: 'French' },
  { code: 'de', label: 'German' },
  { code: 'ja', label: 'Japanese' }
];

interface FamilyMember {
  id?: string;
  name: string;
  relationship: string;
  birthday?: string;
  anniversary?: string;
}

export const OnboardingPage: React.FC = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Step 1: Personal
  const [personal, setPersonal] = useState({
    full_name: '',
    email: '',
    dob: '',
    profession: 'Working Professional',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    preferred_language: 'en',
    wedding_anniversary: ''
  });

  // Step 2: Family
  const [family, setFamily] = useState<FamilyMember[]>([]);
  const [newMember, setNewMember] = useState<FamilyMember>({
    name: '',
    relationship: 'Partner',
    birthday: '',
    anniversary: ''
  });

  // Step 3: Preferences
  const [preferences, setPreferences] = useState({
    doc_organization: 1,
    bill_tracking: 1,
    deadline_mgmt: 1,
    app_checklists: 1,
    calendar_appts: 1,
    family_reminders: 1,
    daily_briefing: 1,
    voice_assistant: 1
  });

  useEffect(() => {
    async function loadCurrent() {
      try {
        const session = await authApi.getSession();
        if (session.profile) {
          setPersonal(prev => ({
            ...prev,
            full_name: session.profile.full_name || prev.full_name,
            email: session.profile.email || prev.email,
            dob: session.profile.dob || '',
            profession: session.profile.profession || 'Working Professional',
            timezone: session.profile.timezone || prev.timezone,
            wedding_anniversary: session.profile.wedding_anniversary || ''
          }));
        }
      } catch (err) {}
    }
    loadCurrent();
  }, []);

  const addFamilyMember = () => {
    if (!newMember.name) return;
    setFamily(prev => [...prev, { ...newMember, id: Date.now().toString() }]);
    setNewMember({
      name: '',
      relationship: 'Partner',
      birthday: '',
      anniversary: ''
    });
  };

  const removeFamilyMember = (index: number) => {
    setFamily(prev => prev.filter((_, i) => i !== index));
  };

  const togglePreference = (key: keyof typeof preferences) => {
    setPreferences(prev => ({
      ...prev,
      [key]: prev[key] === 1 ? 0 : 1
    }));
  };

  const handleFinishOnboarding = async () => {
    setLoading(true);
    setError('');

    try {
      await profileApi.completeOnboarding({
        personal,
        family,
        preferences
      });
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Failed to save onboarding data.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070B14] text-slate-100 flex flex-col items-center justify-center p-4 sm:p-6 relative">
      {/* Background glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-indigo-600/10 blur-[130px] pointer-events-none rounded-full" />

      {/* Progress Bar Container */}
      <div className="w-full max-w-2xl mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-400" />
            <span className="font-bold font-['Manrope'] tracking-tight text-white">Orbi Setup</span>
          </div>
          <span className="text-xs text-indigo-300 font-medium bg-indigo-500/15 border border-indigo-500/30 px-2.5 py-1 rounded-full">
            Step {currentStep} of 4
          </span>
        </div>

        {/* 4 Step Progress Indicators */}
        <div className="grid grid-cols-4 gap-2">
          {[1, 2, 3, 4].map(s => (
            <div
              key={s}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                s <= currentStep ? 'bg-indigo-500 shadow-sm shadow-indigo-500/50' : 'bg-slate-800'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Card Content */}
      <div className="w-full max-w-2xl rounded-3xl bg-[#0D1527]/85 border border-white/10 shadow-2xl p-6 sm:p-8 backdrop-blur-2xl">
        {error && (
          <div className="mb-6 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
            {error}
          </div>
        )}

        {/* STEP 1: PERSONAL INFORMATION */}
        {currentStep === 1 && (
          <div className="space-y-5 animate-in fade-in">
            <div>
              <h2 className="text-xl font-bold text-white font-['Manrope']">Personal Information</h2>
              <p className="text-xs text-slate-400 mt-1">Tell Orbi about yourself to personalize briefings and communications.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <GlassInput
                label="Full Name"
                placeholder="Eleanor Vance"
                value={personal.full_name}
                onChange={(e) => setPersonal({ ...personal, full_name: e.target.value })}
                required
              />
              <GlassInput
                label="Email Address"
                type="email"
                placeholder="eleanor@example.com"
                value={personal.email}
                onChange={(e) => setPersonal({ ...personal, email: e.target.value })}
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <GlassInput
                label="Date of Birth"
                type="date"
                value={personal.dob}
                onChange={(e) => setPersonal({ ...personal, dob: e.target.value })}
              />
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-slate-300">Profession</label>
                <select
                  value={personal.profession}
                  onChange={(e) => setPersonal({ ...personal, profession: e.target.value })}
                  className="bg-[#0B1120]/70 text-slate-100 rounded-xl border border-white/10 px-3.5 py-2 text-sm focus:outline-none focus:border-indigo-400/40 focus:ring-4 focus:ring-indigo-500/20"
                >
                  {PROFESSIONS.map(p => (
                    <option key={p} value={p} className="bg-slate-900 text-slate-100">{p}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <GlassInput
                label="Time Zone"
                value={personal.timezone}
                onChange={(e) => setPersonal({ ...personal, timezone: e.target.value })}
              />
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-slate-300">Preferred Language</label>
                <select
                  value={personal.preferred_language}
                  onChange={(e) => setPersonal({ ...personal, preferred_language: e.target.value })}
                  className="bg-[#0B1120]/70 text-slate-100 rounded-xl border border-white/10 px-3.5 py-2 text-sm focus:outline-none focus:border-indigo-400/40 focus:ring-4 focus:ring-indigo-500/20"
                >
                  {LANGUAGES.map(l => (
                    <option key={l.code} value={l.code} className="bg-slate-900 text-slate-100">{l.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="pt-4 flex justify-end">
              <GlassButton
                variant="primary"
                onClick={() => {
                  if (!personal.full_name) {
                    setError('Please provide your full name.');
                    return;
                  }
                  setError('');
                  setCurrentStep(2);
                }}
                icon={<ArrowRight className="w-4 h-4 ml-1" />}
              >
                Continue to Family
              </GlassButton>
            </div>
          </div>
        )}

        {/* STEP 2: FAMILY DETAILS (SKIPPABLE) */}
        {currentStep === 2 && (
          <div className="space-y-5 animate-in fade-in">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white font-['Manrope']">Family & Milestones</h2>
                <p className="text-xs text-slate-400 mt-1">Optional. Track loved ones' birthdays and milestones.</p>
              </div>
              <span className="text-[11px] text-slate-400 bg-white/5 px-2 py-0.5 rounded">Optional</span>
            </div>

            <GlassInput
              label="Wedding Anniversary (Optional)"
              type="date"
              value={personal.wedding_anniversary}
              onChange={(e) => setPersonal({ ...personal, wedding_anniversary: e.target.value })}
            />

            {/* Existing Family Members List */}
            {family.length > 0 && (
              <div className="space-y-2 mt-4">
                <label className="text-xs font-medium text-slate-300">Recorded Family Members</label>
                <div className="divide-y divide-white/5 border border-white/10 rounded-xl bg-slate-900/40 p-2">
                  {family.map((m, idx) => (
                    <div key={idx} className="flex items-center justify-between py-2 px-2">
                      <div>
                        <p className="text-sm font-medium text-slate-200">{m.name}</p>
                        <p className="text-xs text-slate-400">{m.relationship} {m.birthday ? `• Birthday: ${m.birthday}` : ''}</p>
                      </div>
                      <button
                        onClick={() => removeFamilyMember(idx)}
                        className="text-slate-400 hover:text-rose-400 p-1.5"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Add Member Form */}
            <div className="p-4 rounded-2xl bg-white/5 border border-white/5 space-y-3">
              <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5 text-indigo-400" /> Add Family Member
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <GlassInput
                  placeholder="Name"
                  value={newMember.name}
                  onChange={(e) => setNewMember({ ...newMember, name: e.target.value })}
                />
                <select
                  value={newMember.relationship}
                  onChange={(e) => setNewMember({ ...newMember, relationship: e.target.value })}
                  className="bg-[#0B1120]/70 text-slate-100 rounded-xl border border-white/10 px-3 py-2 text-xs focus:outline-none"
                >
                  <option value="Partner">Partner / Spouse</option>
                  <option value="Child">Child</option>
                  <option value="Parent">Parent</option>
                  <option value="Sibling">Sibling</option>
                  <option value="Relative">Relative</option>
                  <option value="Friend">Close Friend</option>
                </select>
                <GlassInput
                  type="date"
                  placeholder="Birthday"
                  value={newMember.birthday}
                  onChange={(e) => setNewMember({ ...newMember, birthday: e.target.value })}
                />
              </div>
              <GlassButton
                type="button"
                variant="secondary"
                size="sm"
                onClick={addFamilyMember}
              >
                Add Member
              </GlassButton>
            </div>

            <div className="pt-4 flex items-center justify-between">
              <GlassButton
                variant="ghost"
                onClick={() => setCurrentStep(1)}
                icon={<ArrowLeft className="w-4 h-4 mr-1" />}
              >
                Back
              </GlassButton>
              <GlassButton
                variant="primary"
                onClick={() => setCurrentStep(3)}
                icon={<ArrowRight className="w-4 h-4 ml-1" />}
              >
                {family.length === 0 ? "Skip / Continue" : "Continue to Preferences"}
              </GlassButton>
            </div>
          </div>
        )}

        {/* STEP 3: PREFERENCES */}
        {currentStep === 3 && (
          <div className="space-y-5 animate-in fade-in">
            <div>
              <h2 className="text-xl font-bold text-white font-['Manrope']">Assistant Preferences</h2>
              <p className="text-xs text-slate-400 mt-1">Select the intelligence modules you want Orbi to manage actively.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { key: 'doc_organization', label: 'Document Organization', desc: 'Auto-categorize and extract data from PDFs' },
                { key: 'bill_tracking', label: 'Bill Tracking', desc: 'Track upcoming bills & advance reminders' },
                { key: 'deadline_mgmt', label: 'Deadline Management', desc: 'Proactive alerts for upcoming obligations' },
                { key: 'app_checklists', label: 'Application Companion', desc: 'Multi-step guidance for visas, loans, etc.' },
                { key: 'calendar_appts', label: 'Calendar & Appointments', desc: 'Sync schedules and milestone events' },
                { key: 'family_reminders', label: 'Family Reminders', desc: 'Advance notices for birthdays & anniversaries' },
                { key: 'daily_briefing', label: 'Daily Briefing', desc: 'Executive morning agenda summary' },
                { key: 'voice_assistant', label: 'Voice Assistant', desc: 'Enable speech recognition and audio readout' },
              ].map(item => (
                <div
                  key={item.key}
                  onClick={() => togglePreference(item.key as any)}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                    preferences[item.key as keyof typeof preferences] === 1
                      ? 'bg-indigo-600/15 border-indigo-500/40 text-slate-200'
                      : 'bg-slate-900/40 border-white/5 text-slate-400 hover:border-white/10'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-200">{item.label}</span>
                    <div className={`w-4 h-4 rounded-full flex items-center justify-center border ${
                      preferences[item.key as keyof typeof preferences] === 1
                        ? 'bg-indigo-500 border-indigo-400 text-white'
                        : 'border-slate-600'
                    }`}>
                      {preferences[item.key as keyof typeof preferences] === 1 && (
                        <CheckCircle2 className="w-3 h-3" />
                      )}
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 leading-snug">{item.desc}</p>
                </div>
              ))}
            </div>

            <div className="pt-4 flex items-center justify-between">
              <GlassButton
                variant="ghost"
                onClick={() => setCurrentStep(2)}
                icon={<ArrowLeft className="w-4 h-4 mr-1" />}
              >
                Back
              </GlassButton>
              <GlassButton
                variant="primary"
                onClick={() => setCurrentStep(4)}
                icon={<ArrowRight className="w-4 h-4 ml-1" />}
              >
                Review Profile
              </GlassButton>
            </div>
          </div>
        )}

        {/* STEP 4: REVIEW & CONFIRM */}
        {currentStep === 4 && (
          <div className="space-y-5 animate-in fade-in">
            <div>
              <h2 className="text-xl font-bold text-white font-['Manrope']">Review & Save Profile</h2>
              <p className="text-xs text-slate-400 mt-1">Review your details before Orbi initializes your workspace.</p>
            </div>

            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-white/5 border border-white/5 space-y-2">
                <span className="text-xs font-semibold text-indigo-300">Personal Details</span>
                <div className="grid grid-cols-2 text-xs gap-y-1 text-slate-300">
                  <span className="text-slate-500">Name:</span> <span>{personal.full_name}</span>
                  <span className="text-slate-500">Email:</span> <span>{personal.email}</span>
                  <span className="text-slate-500">Profession:</span> <span>{personal.profession}</span>
                  <span className="text-slate-500">Time Zone:</span> <span>{personal.timezone}</span>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-white/5 border border-white/5 space-y-2">
                <span className="text-xs font-semibold text-indigo-300">Family & Milestones</span>
                {family.length > 0 ? (
                  <ul className="text-xs text-slate-300 space-y-1">
                    {family.map((f, i) => (
                      <li key={i}>• {f.name} ({f.relationship}) {f.birthday ? `- Birthday: ${f.birthday}` : ''}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-slate-500">No family members added (can be added later).</p>
                )}
              </div>

              <div className="p-4 rounded-2xl bg-white/5 border border-white/5 space-y-2">
                <span className="text-xs font-semibold text-indigo-300">Active Modules</span>
                <p className="text-xs text-slate-300">
                  {Object.values(preferences).filter(v => v === 1).length} of 8 intelligence modules enabled.
                </p>
              </div>
            </div>

            <div className="pt-4 flex items-center justify-between">
              <GlassButton
                variant="ghost"
                onClick={() => setCurrentStep(3)}
                icon={<ArrowLeft className="w-4 h-4 mr-1" />}
              >
                Back
              </GlassButton>
              <GlassButton
                variant="primary"
                onClick={handleFinishOnboarding}
                loading={loading}
                icon={<Sparkles className="w-4 h-4 ml-1" />}
              >
                Open Personalized Dashboard
              </GlassButton>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
