import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Settings,
  User,
  ShieldCheck,
  Bell,
  Trash2,
  Lock,
  Plus,
  Check,
  AlertTriangle,
  RotateCcw
} from 'lucide-react';
import {
  GlassCard,
  GlassButton,
  GlassInput,
  LoadingState,
  ErrorState
} from '../components/common/GlassComponents';
import { profileApi, authApi, clearAuthToken } from '../services/api';

export const SettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Profile data
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [dob, setDob] = useState('');
  const [profession, setProfession] = useState('Working Professional');
  const [timezone, setTimezone] = useState('UTC');
  const [anniversary, setAnniversary] = useState('');

  // Preferences
  const [preferences, setPreferences] = useState<any>({});

  // Family members
  const [family, setFamily] = useState<any[]>([]);
  const [newFamilyName, setNewFamilyName] = useState('');
  const [newFamilyRel, setNewFamilyRel] = useState('Partner');
  const [newFamilyBday, setNewFamilyBday] = useState('');

  const loadProfile = async () => {
    setLoading(true);
    try {
      const data = await profileApi.getProfile();
      if (data.profile) {
        setFullName(data.profile.full_name || '');
        setEmail(data.profile.email || '');
        setDob(data.profile.dob || '');
        setProfession(data.profile.profession || 'Working Professional');
        setTimezone(data.profile.timezone || 'UTC');
        setAnniversary(data.profile.wedding_anniversary || '');
      }
      setPreferences(data.preferences || {});
      setFamily(data.family || []);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load profile settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMsg('');
    setErrorMsg('');

    try {
      await profileApi.updateProfile({
        full_name: fullName,
        email,
        dob,
        profession,
        timezone,
        wedding_anniversary: anniversary
      });
      await profileApi.updatePreferences(preferences);
      setSuccessMsg('Settings saved successfully.');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  const handleAddFamily = async () => {
    if (!newFamilyName) return;
    try {
      const member = await profileApi.addFamilyMember({
        name: newFamilyName,
        relationship: newFamilyRel,
        birthday: newFamilyBday
      });
      setFamily(prev => [...prev, member]);
      setNewFamilyName('');
      setNewFamilyBday('');
    } catch (err: any) {
      alert(err.message || 'Failed to add family member');
    }
  };

  const handleDeleteFamily = async (id: string) => {
    try {
      await profileApi.deleteFamilyMember(id);
      setFamily(prev => prev.filter(m => m.id !== id));
    } catch (err: any) {
      alert(err.message || 'Failed to delete');
    }
  };

  const togglePref = (key: string) => {
    setPreferences((prev: any) => ({
      ...prev,
      [key]: prev[key] === 1 ? 0 : 1
    }));
  };

  const handleClearSession = () => {
    if (!window.confirm("Sign out of Orbi?")) return;
    clearAuthToken();
    navigate('/');
  };

  if (loading) {
    return <LoadingState message="Loading settings & privacy configurations..." />;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in">
      {/* Header */}
      <div className="pb-2 border-b border-white/5">
        <div className="flex items-center gap-2 text-indigo-400 text-xs font-semibold uppercase tracking-wider mb-1">
          <Settings className="w-4 h-4" />
          <span>Configuration & Privacy</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white font-['Manrope']">
          Settings
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Manage your personal details, family members, notification preferences, and privacy controls.
        </p>
      </div>

      {successMsg && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center gap-2">
          <Check className="w-4 h-4" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          <span>{errorMsg}</span>
        </div>
      )}

      <form onSubmit={handleSaveProfile} className="space-y-6">
        {/* Personal Details */}
        <GlassCard className="p-6 space-y-4">
          <h3 className="text-base font-semibold text-slate-100 flex items-center gap-2">
            <User className="w-4 h-4 text-indigo-400" />
            <span>Profile Details</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <GlassInput
              label="Full Name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
            <GlassInput
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <GlassInput
              label="Date of Birth"
              type="date"
              value={dob}
              onChange={(e) => setDob(e.target.value)}
            />
            <GlassInput
              label="Wedding Anniversary"
              type="date"
              value={anniversary}
              onChange={(e) => setAnniversary(e.target.value)}
            />
            <GlassInput
              label="Time Zone"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
            />
          </div>
        </GlassCard>

        {/* Intelligence Modules Preferences */}
        <GlassCard className="p-6 space-y-4">
          <h3 className="text-base font-semibold text-slate-100 flex items-center gap-2">
            <Bell className="w-4 h-4 text-indigo-400" />
            <span>Active Modules & Reminders</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { key: 'bill_tracking', label: 'Proactive Bill Tracking' },
              { key: 'deadline_mgmt', label: 'Deadline Management' },
              { key: 'app_checklists', label: 'Application Companion' },
              { key: 'daily_briefing', label: 'Daily Executive Briefing' },
              { key: 'family_reminders', label: 'Family Birthday Reminders' },
              { key: 'voice_assistant', label: 'Voice Assistant Readout' },
            ].map(item => (
              <div
                key={item.key}
                onClick={() => togglePref(item.key)}
                className={`p-3 rounded-xl border cursor-pointer flex items-center justify-between text-xs transition-colors ${
                  preferences[item.key] === 1
                    ? 'bg-indigo-600/15 border-indigo-500/30 text-slate-200'
                    : 'bg-slate-900/40 border-white/5 text-slate-400'
                }`}
              >
                <span>{item.label}</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  preferences[item.key] === 1 ? 'bg-indigo-500/20 text-indigo-300' : 'bg-slate-800 text-slate-500'
                }`}>
                  {preferences[item.key] === 1 ? 'Enabled' : 'Disabled'}
                </span>
              </div>
            ))}
          </div>
        </GlassCard>

        <div className="flex justify-end">
          <GlassButton
            type="submit"
            variant="primary"
            loading={saving}
          >
            Save Profile & Preferences
          </GlassButton>
        </div>
      </form>

      {/* Family Details Management */}
      <GlassCard className="p-6 space-y-4">
        <h3 className="text-base font-semibold text-slate-100 flex items-center gap-2">
          <User className="w-4 h-4 text-indigo-400" />
          <span>Family Members & Milestones</span>
        </h3>

        {family.length > 0 ? (
          <div className="divide-y divide-white/5 border border-white/10 rounded-xl bg-[#070B14]/40 overflow-hidden">
            {family.map((m) => (
              <div key={m.id} className="p-3 flex items-center justify-between text-xs">
                <div>
                  <p className="font-semibold text-slate-200">{m.name} ({m.relationship})</p>
                  <p className="text-[11px] text-slate-400">
                    {m.birthday ? `Birthday: ${m.birthday}` : 'No birthday recorded'}
                  </p>
                </div>
                <button
                  onClick={() => handleDeleteFamily(m.id)}
                  className="p-1.5 text-slate-400 hover:text-rose-400"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-500">No family members recorded yet.</p>
        )}

        <div className="pt-2 flex flex-col sm:flex-row gap-2">
          <GlassInput
            placeholder="Name"
            value={newFamilyName}
            onChange={(e) => setNewFamilyName(e.target.value)}
          />
          <GlassInput
            type="date"
            placeholder="Birthday"
            value={newFamilyBday}
            onChange={(e) => setNewFamilyBday(e.target.value)}
          />
          <GlassButton
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleAddFamily}
            icon={<Plus className="w-3.5 h-3.5" />}
          >
            Add Member
          </GlassButton>
        </div>
      </GlassCard>

      {/* Privacy Safeguards Section */}
      <GlassCard className="p-6 space-y-3 border-indigo-500/20">
        <div className="flex items-center gap-2 text-indigo-400">
          <ShieldCheck className="w-5 h-5" />
          <h3 className="text-base font-semibold text-slate-100">
            Privacy & Security Architecture
          </h3>
        </div>
        <p className="text-xs text-slate-400 leading-relaxed">
          Orbi is built with zero data monetization. Uploaded PDF files are isolated in your personal encrypted vault. AI synthesis relies strictly on retrieved user records, with zero third-party training on your private files.
        </p>

        <div className="pt-3 flex items-center justify-between border-t border-white/5 text-xs">
          <span className="text-slate-400">Session ID: {localStorage.getItem('orbi_token')?.slice(0, 16)}...</span>
          <GlassButton
            variant="outline"
            size="sm"
            onClick={handleClearSession}
          >
            Sign Out
          </GlassButton>
        </div>
      </GlassCard>
    </div>
  );
};
