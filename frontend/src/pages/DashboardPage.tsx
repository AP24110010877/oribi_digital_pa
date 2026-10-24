import React, { useState, useEffect } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import {
  Sparkles,
  Receipt,
  Compass,
  Calendar,
  FolderOpen,
  ArrowRight,
  Search,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Upload,
  Plus,
  Send,
  Mic,
  ChevronRight
} from 'lucide-react';
import {
  GlassCard,
  GlassButton,
  GlassInput,
  LoadingState,
  EmptyState,
  ErrorState
} from '../components/common/GlassComponents';
import {
  briefingApi,
  billApi,
  applicationApi,
  calendarApi,
  documentApi,
  assistantApi
} from '../services/api';
import { formatDateDMY, formatDateTimeDMY, formatGreeting } from '../utils/dateUtils';

const formatRupees = (amount: number | string, currency: string = 'INR') => {
  const num = Number(amount || 0);
  const symbol = currency === 'INR' ? '₹' : currency === 'USD' ? '$' : currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : `${currency} `;
  return `${symbol}${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { userProfile } = useOutletContext<{ userProfile?: any }>() || {};
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [briefing, setBriefing] = useState<any>(null);
  const [bills, setBills] = useState<any[]>([]);
  const [applications, setApplications] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);

  // Ask Orbi quick input
  const [askQuery, setAskQuery] = useState('');
  const [askLoading, setAskLoading] = useState(false);
  const [quickAnswer, setQuickAnswer] = useState<any>(null);

  const loadDashboardData = async () => {
    setLoading(true);
    setError('');
    try {
      const [bData, billsData, appsData, eventsData, docsData] = await Promise.all([
        briefingApi.getToday(),
        billApi.list(),
        applicationApi.list(),
        calendarApi.getEvents(),
        documentApi.list(),
      ]);

      setBriefing(bData);
      setBills(billsData);
      setApplications(appsData);
      setEvents(eventsData);
      setDocuments(docsData);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to fetch dashboard data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  const handleQuickAsk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!askQuery.trim()) return;

    setAskLoading(true);
    try {
      const res = await assistantApi.ask(askQuery);
      setQuickAnswer(res);
      setAskQuery('');
    } catch (err: any) {
      console.error(err);
    } finally {
      setAskLoading(false);
    }
  };

  const handleMarkBillPaid = async (billId: string) => {
    try {
      await billApi.updateStatus(billId, 'paid');
      loadDashboardData();
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return <LoadingState message="Synthesizing today's briefing and personal records..." />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={loadDashboardData} />;
  }

  const upcomingBills = bills.filter(b => b.status !== 'paid');
  const activeApps = applications.filter(a => a.status !== 'completed');

  return (
    <div className="space-y-8 animate-in fade-in">
      {/* Top Welcome / Daily Briefing Hero Banner */}
      <div className="relative rounded-3xl bg-gradient-to-r from-indigo-950/40 via-[#0D1527] to-slate-900/40 border border-indigo-500/20 p-6 md:p-8 backdrop-blur-2xl shadow-xl shadow-black/20">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-indigo-400 text-xs font-semibold uppercase tracking-wider mb-1">
              <Sparkles className="w-4 h-4" />
              <span>Today's Briefing • {formatDateDMY(briefing?.date, userProfile?.timezone)}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white font-['Manrope']">
              {briefing?.greeting || formatGreeting(userProfile?.full_name)}
            </h1>
            <p className="text-sm text-slate-300 mt-2 max-w-2xl leading-relaxed">
              {briefing?.summary}
            </p>
          </div>

          <div className="flex items-center gap-2 self-stretch md:self-auto">
            <GlassButton
              variant="primary"
              size="sm"
              icon={<Upload className="w-4 h-4" />}
              onClick={() => navigate('/documents')}
            >
              Upload PDF
            </GlassButton>
            <GlassButton
              variant="secondary"
              size="sm"
              icon={<Plus className="w-4 h-4" />}
              onClick={() => navigate('/applications')}
            >
              New Application
            </GlassButton>
          </div>
        </div>

        {/* Smart Alerts Bar */}
        {briefing?.alerts && briefing.alerts.length > 0 && (
          <div className="mt-6 pt-5 border-t border-white/5 space-y-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Actionable Smart Alerts
            </span>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {briefing.alerts.slice(0, 4).map((alert: any, idx: number) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 rounded-xl bg-slate-900/60 border border-white/5 text-xs hover:border-indigo-500/30 transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0 pr-2">
                    <AlertTriangle className={`w-4 h-4 shrink-0 ${alert.severity === 'high' ? 'text-amber-400' : 'text-indigo-400'}`} />
                    <div className="min-w-0">
                      <p className="font-medium text-slate-200 truncate">{alert.title}</p>
                      <p className="text-[11px] text-slate-400 truncate">{alert.description}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => navigate(alert.action_url)}
                    className="text-[11px] text-indigo-400 hover:text-indigo-300 font-medium shrink-0 flex items-center gap-1"
                  >
                    <span>{alert.action_text}</span>
                    <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <GlassCard className="p-4" onClick={() => navigate('/bills')}>
          <div className="flex items-center justify-between text-indigo-400 mb-2">
            <Receipt className="w-4 h-4" />
            <span className="text-[10px] uppercase font-semibold text-slate-500">Bills</span>
          </div>
          <p className="text-2xl font-bold text-white font-['Manrope']">{upcomingBills.length}</p>
          <p className="text-xs text-slate-400 mt-0.5">Pending due</p>
        </GlassCard>

        <GlassCard className="p-4" onClick={() => navigate('/applications')}>
          <div className="flex items-center justify-between text-indigo-400 mb-2">
            <Compass className="w-4 h-4" />
            <span className="text-[10px] uppercase font-semibold text-slate-500">Companion</span>
          </div>
          <p className="text-2xl font-bold text-white font-['Manrope']">{activeApps.length}</p>
          <p className="text-xs text-slate-400 mt-0.5">Active workflows</p>
        </GlassCard>

        <GlassCard className="p-4" onClick={() => navigate('/calendar')}>
          <div className="flex items-center justify-between text-indigo-400 mb-2">
            <Calendar className="w-4 h-4" />
            <span className="text-[10px] uppercase font-semibold text-slate-500">Schedule</span>
          </div>
          <p className="text-2xl font-bold text-white font-['Manrope']">{events.length}</p>
          <p className="text-xs text-slate-400 mt-0.5">Upcoming events</p>
        </GlassCard>

        <GlassCard className="p-4" onClick={() => navigate('/documents')}>
          <div className="flex items-center justify-between text-indigo-400 mb-2">
            <FolderOpen className="w-4 h-4" />
            <span className="text-[10px] uppercase font-semibold text-slate-500">Memory</span>
          </div>
          <p className="text-2xl font-bold text-white font-['Manrope']">{documents.length}</p>
          <p className="text-xs text-slate-400 mt-0.5">Analyzed docs</p>
        </GlassCard>
      </div>

      {/* Ask Orbi Quick Query Box */}
      <GlassCard className="p-5 border-indigo-500/25">
        <form onSubmit={handleQuickAsk} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-indigo-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Ask Orbi: 'Which bills are due soon?' or 'What documents are missing?'"
              value={askQuery}
              onChange={(e) => setAskQuery(e.target.value)}
              className="w-full bg-[#070B14]/70 text-slate-100 placeholder-slate-500 rounded-xl border border-white/10 px-4 py-2.5 pl-10 text-sm focus:outline-none focus:border-indigo-400/50 focus:ring-4 focus:ring-indigo-500/20 transition-all"
            />
          </div>
          <GlassButton
            type="submit"
            variant="primary"
            loading={askLoading}
            icon={<Send className="w-4 h-4" />}
          >
            Ask Orbi
          </GlassButton>
        </form>

        {/* Quick Answer Banner */}
        {quickAnswer && (
          <div className="mt-4 p-4 rounded-xl bg-slate-900/80 border border-indigo-500/20 animate-in fade-in">
            <div className="flex items-center gap-2 text-indigo-400 text-xs font-semibold mb-1">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Orbi Response</span>
            </div>
            <p className="text-xs text-slate-200 leading-relaxed whitespace-pre-wrap">{quickAnswer.answer}</p>
            {quickAnswer.source_references?.length > 0 && (
              <div className="mt-3 pt-2 border-t border-white/5 flex flex-wrap gap-2">
                <span className="text-[10px] text-slate-500">Citations:</span>
                {quickAnswer.source_references.map((ref: any, idx: number) => (
                  <span key={idx} className="text-[10px] px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                    {ref.title || ref.type}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </GlassCard>

      {/* Main Two-Column Grid: Left: Applications & Bills | Right: Calendar & Documents */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Signature Application Companion & Bills */}
        <div className="space-y-6">
          {/* Applications */}
          <GlassCard className="p-6">
            <div className="flex items-center justify-between pb-4 border-b border-white/5">
              <div className="flex items-center gap-2">
                <Compass className="w-5 h-5 text-indigo-400" />
                <h3 className="text-base font-semibold text-slate-100 font-['Manrope']">
                  Application Companion
                </h3>
              </div>
              <button
                onClick={() => navigate('/applications')}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1"
              >
                <span>View all</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              {activeApps.length === 0 ? (
                <EmptyState
                  title="No Active Applications"
                  description="Start a multi-step checklist for your visa, admission, or mortgage."
                  action={{
                    label: "Start New Application",
                    onClick: () => navigate('/applications')
                  }}
                  className="py-6"
                />
              ) : (
                activeApps.map(wf => (
                  <div key={wf.id} className="p-3.5 rounded-xl bg-slate-900/50 border border-white/5 hover:border-indigo-500/30 transition-all">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-slate-200">{wf.title}</span>
                      <span className="text-xs font-semibold text-indigo-300">{wf.progress}%</span>
                    </div>
                    {/* Linear Progress */}
                    <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-indigo-500 h-1.5 rounded-full transition-all duration-500"
                        style={{ width: `${wf.progress}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between mt-2 text-[11px] text-slate-400">
                      <span>{wf.completed_steps || 0} of {wf.total_steps || 0} steps completed</span>
                      <button
                        onClick={() => navigate(`/applications`)}
                        className="text-indigo-400 hover:text-indigo-300"
                      >
                        Next Step &rarr;
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </GlassCard>

          {/* Bills Approaching Due Date */}
          <GlassCard className="p-6">
            <div className="flex items-center justify-between pb-4 border-b border-white/5">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-indigo-400" />
                <h3 className="text-base font-semibold text-slate-100 font-['Manrope']">
                  Upcoming Bills
                </h3>
              </div>
              <button
                onClick={() => navigate('/bills')}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1"
              >
                <span>Manage bills</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="mt-4 space-y-2.5">
              {upcomingBills.length === 0 ? (
                <EmptyState
                  title="No Pending Bills"
                  description="All tracked bills are paid or up to date."
                  className="py-6"
                />
              ) : (
                upcomingBills.slice(0, 4).map(bill => (
                  <div key={bill.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-900/50 border border-white/5 hover:border-white/10 transition-all">
                    <div>
                      <p className="text-sm font-medium text-slate-200">{bill.title}</p>
                      <p className="text-xs text-slate-400">
                        {formatRupees(bill.amount, bill.currency || 'INR')} • Due {formatDateDMY(bill.due_date, userProfile?.timezone)}
                      </p>
                    </div>
                    <GlassButton
                      variant="outline"
                      size="sm"
                      onClick={() => handleMarkBillPaid(bill.id)}
                      icon={<CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                    >
                      Mark Paid
                    </GlassButton>
                  </div>
                ))
              )}
            </div>
          </GlassCard>
        </div>

        {/* Right Column: Calendar Events & Recent Documents */}
        <div className="space-y-6">
          {/* Calendar & Family Events */}
          <GlassCard className="p-6">
            <div className="flex items-center justify-between pb-4 border-b border-white/5">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-indigo-400" />
                <h3 className="text-base font-semibold text-slate-100 font-['Manrope']">
                  Upcoming Appointments & Events
                </h3>
              </div>
              <button
                onClick={() => navigate('/calendar')}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1"
              >
                <span>Open Calendar</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="mt-4 space-y-2.5">
              {events.length === 0 ? (
                <EmptyState
                  title="Schedule is Clear"
                  description="No appointments, birthdays, or reminders scheduled for this period."
                  action={{
                    label: "Add Event",
                    onClick: () => navigate('/calendar')
                  }}
                  className="py-6"
                />
              ) : (
                events.slice(0, 4).map(event => (
                  <div key={event.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-900/50 border border-white/5">
                    <div>
                      <p className="text-sm font-medium text-slate-200">{event.title}</p>
                      <p className="text-xs text-slate-400">
                        {formatDateTimeDMY(event.start_time, userProfile?.timezone)} {event.location ? `• ${event.location}` : ''}
                      </p>
                    </div>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 capitalize">
                      {event.event_type}
                    </span>
                  </div>
                ))
              )}
            </div>
          </GlassCard>

          {/* Smart Memory Documents */}
          <GlassCard className="p-6">
            <div className="flex items-center justify-between pb-4 border-b border-white/5">
              <div className="flex items-center gap-2">
                <FolderOpen className="w-5 h-5 text-indigo-400" />
                <h3 className="text-base font-semibold text-slate-100 font-['Manrope']">
                  Recent Smart Memory Files
                </h3>
              </div>
              <button
                onClick={() => navigate('/documents')}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1"
              >
                <span>View Vault</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="mt-4 space-y-2.5">
              {documents.length === 0 ? (
                <EmptyState
                  title="No Documents Uploaded"
                  description="Upload PDF statements, leases, or notices to extract facts automatically."
                  action={{
                    label: "Upload PDF",
                    onClick: () => navigate('/documents')
                  }}
                  className="py-6"
                />
              ) : (
                documents.slice(0, 4).map(doc => (
                  <div
                    key={doc.id}
                    onClick={() => navigate('/documents')}
                    className="flex items-center justify-between p-3 rounded-xl bg-slate-900/50 border border-white/5 hover:border-indigo-500/30 cursor-pointer transition-all"
                  >
                    <div className="min-w-0 pr-3">
                      <p className="text-sm font-medium text-slate-200 truncate">{doc.original_name}</p>
                      <p className="text-[11px] text-slate-400 truncate mt-0.5">{doc.summary || "PDF parsed by PyMuPDF"}</p>
                    </div>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-300 capitalize shrink-0">
                      {doc.category}
                    </span>
                  </div>
                ))
              )}
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
};
