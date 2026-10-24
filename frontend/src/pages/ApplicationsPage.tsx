import React, { useState, useEffect } from 'react';
import {
  Compass,
  Plus,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  Trash2,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  Layers,
  Calendar,
  Building2,
  Tag
} from 'lucide-react';
import {
  GlassCard,
  GlassButton,
  GlassInput,
  GlassModal,
  LoadingState,
  EmptyState,
  ErrorState
} from '../components/common/GlassComponents';
import { applicationApi } from '../services/api';
import { formatDateDMY } from '../utils/dateUtils';

const APP_CATEGORIES = [
  { key: 'all', label: 'All Applications' },
  { key: 'university_admission', label: 'Admissions' },
  { key: 'scholarship', label: 'Scholarships' },
  { key: 'job_application', label: 'Jobs' },
  { key: 'internship', label: 'Internships' },
  { key: 'visa_immigration', label: 'Visas' },
  { key: 'government_service', label: 'Government' },
  { key: 'permit_license', label: 'Permits' },
  { key: 'loan_mortgage', label: 'Loans' },
  { key: 'insurance_claim', label: 'Insurance' },
  { key: 'rental_application', label: 'Rentals' },
  { key: 'custom', label: 'Custom' }
];

export const ApplicationsPage: React.FC = () => {
  const [workflows, setWorkflows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('all');

  // Propose & Create Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [goal, setGoal] = useState('');
  const [institution, setInstitution] = useState('');
  const [customDeadline, setCustomDeadline] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [proposing, setProposing] = useState(false);
  const [proposal, setProposal] = useState<any>(null);
  const [confirming, setConfirming] = useState(false);

  // Expanded workflow details in list
  const [expandedWfId, setExpandedWfId] = useState<string | null>(null);

  const fetchWorkflows = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await applicationApi.list(selectedFilter);
      setWorkflows(data);
      if (data.length > 0 && !expandedWfId) {
        setExpandedWfId(data[0].id);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load applications');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkflows();
  }, [selectedFilter]);

  const handleGenerateProposal = async (categoryOverride?: string) => {
    if (!goal.trim()) return;

    setProposing(true);
    try {
      const catToUse = categoryOverride || selectedCategory || undefined;
      const res = await applicationApi.propose(goal, institution, undefined, catToUse);
      setProposal(res);
      setSelectedCategory(res.category);
      if (res.deadline && !customDeadline) {
        setCustomDeadline(res.deadline);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to analyze application requirements');
    } finally {
      setProposing(false);
    }
  };

  const handleCategorySwitch = (newCat: string) => {
    setSelectedCategory(newCat);
    handleGenerateProposal(newCat);
  };

  const handleConfirmWorkflow = async () => {
    if (!proposal) return;
    setConfirming(true);
    try {
      await applicationApi.confirm({
        title: proposal.title,
        goal: proposal.goal,
        category: selectedCategory || proposal.category,
        institution: proposal.institution,
        deadline: customDeadline || proposal.deadline,
        checklist_items: proposal.checklist_proposal,
        requirements: proposal.missing_documents,
        clarifying_questions: proposal.clarifying_questions
      });
      setModalOpen(false);
      setProposal(null);
      setGoal('');
      setInstitution('');
      setCustomDeadline('');
      setSelectedCategory('');
      fetchWorkflows();
    } catch (err: any) {
      alert(err.message || 'Failed to confirm workflow');
    } finally {
      setConfirming(false);
    }
  };

  const handleToggleItemStatus = async (wfId: string, itemId: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'completed' ? 'pending' : 'completed';
    try {
      await applicationApi.updateItemStatus(itemId, nextStatus);
      fetchWorkflows();
    } catch (err: any) {
      alert(err.message || 'Failed to update step');
    }
  };

  const handleDeleteWorkflow = async (wfId: string) => {
    if (!window.confirm('Delete this application workflow and all associated checklist steps?')) return;
    try {
      await applicationApi.delete(wfId);
      fetchWorkflows();
    } catch (err: any) {
      alert(err.message || 'Failed to delete');
    }
  };

  const getCategoryBadgeColor = (category?: string) => {
    switch (category) {
      case 'university_admission':
        return 'bg-purple-500/20 text-purple-300 border-purple-500/30';
      case 'scholarship':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
      case 'job_application':
        return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
      case 'internship':
        return 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30';
      case 'insurance_claim':
        return 'bg-rose-500/20 text-rose-300 border-rose-500/30';
      case 'loan_mortgage':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
      case 'rental_application':
        return 'bg-orange-500/20 text-orange-300 border-orange-500/30';
      case 'visa_immigration':
        return 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30';
      case 'government_service':
      case 'permit_license':
        return 'bg-teal-500/20 text-teal-300 border-teal-500/30';
      default:
        return 'bg-slate-700/40 text-slate-300 border-white/10';
    }
  };

  const formatCategoryLabel = (category?: string) => {
    const match = APP_CATEGORIES.find(c => c.key === category);
    return match ? match.label : (category ? category.replace(/_/g, ' ') : 'General');
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-white/5">
        <div>
          <div className="flex items-center gap-2 text-indigo-400 text-xs font-semibold uppercase tracking-wider mb-1">
            <Compass className="w-4 h-4" />
            <span>General-Purpose Application Companion</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white font-['Manrope']">
            Application Companion
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Manage university admissions, job roles, scholarships, insurance claims, visas, permits, and custom goals with verified Smart Memory documents.
          </p>
        </div>

        <GlassButton
          variant="primary"
          icon={<Plus className="w-4 h-4" />}
          onClick={() => {
            setProposal(null);
            setGoal('');
            setInstitution('');
            setCustomDeadline('');
            setSelectedCategory('');
            setModalOpen(true);
          }}
        >
          Start New Application
        </GlassButton>
      </div>

      {/* Category Filter Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {APP_CATEGORIES.map(cat => (
          <button
            key={cat.key}
            onClick={() => setSelectedFilter(cat.key)}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
              selectedFilter === cat.key
                ? 'bg-indigo-600/30 text-indigo-200 border border-indigo-400/40 shadow-sm'
                : 'bg-slate-900/40 text-slate-400 hover:text-slate-200 border border-white/5'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Workflows List */}
      {loading ? (
        <LoadingState message="Scanning application companion workflows..." />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchWorkflows} />
      ) : workflows.length === 0 ? (
        <EmptyState
          icon={<Compass className="w-8 h-8 text-indigo-400" />}
          title="No Active Applications in this Category"
          description="Enter any legitimate goal: university admission, job opening, scholarship, loan, insurance claim, or custom workflow."
          action={{
            label: "Prepare an Application",
            onClick: () => {
              setProposal(null);
              setGoal('');
              setInstitution('');
              setCustomDeadline('');
              setSelectedCategory('');
              setModalOpen(true);
            }
          }}
        />
      ) : (
        <div className="space-y-4">
          {workflows.map(wf => {
            const isExpanded = expandedWfId === wf.id;
            const items: any[] = wf.checklist_items || [];
            const pendingItems = items.filter(it => it.status !== 'completed');
            const verifiedCount = items.filter(it => it.is_verified).length;

            return (
              <GlassCard key={wf.id} className="p-6 transition-all border-white/10 hover:border-indigo-500/30">
                {/* Header Row */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${getCategoryBadgeColor(wf.category)}`}>
                        {formatCategoryLabel(wf.category)}
                      </span>
                      <h3 className="text-base sm:text-lg font-bold text-white font-['Manrope'] truncate">
                        {wf.title}
                      </h3>
                      <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${
                        wf.status === 'completed'
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                          : 'bg-indigo-500/20 text-indigo-300 border-indigo-400/30'
                      }`}>
                        {wf.status === 'completed' ? 'Completed' : 'In Progress'}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400 mt-1">
                      <span className="flex items-center gap-1">
                        <Building2 className="w-3.5 h-3.5 text-slate-500" />
                        Target: <strong className="text-slate-200">{wf.institution || 'Authority'}</strong>
                      </span>
                      {wf.deadline && (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-slate-500" />
                          Deadline: <strong className="text-indigo-300">{formatDateDMY(wf.deadline)}</strong>
                        </span>
                      )}
                      <span>
                        Tasks: <strong className="text-slate-200">{wf.completed_steps || 0} / {wf.total_steps || 0} done</strong>
                      </span>
                      {verifiedCount > 0 && (
                        <span className="flex items-center gap-1 text-emerald-400">
                          <ShieldCheck className="w-3.5 h-3.5" />
                          {verifiedCount} verified official requirement(s)
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Progress & Controls */}
                  <div className="flex items-center gap-4 self-end md:self-auto">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-indigo-300">{wf.progress}%</span>
                      <div className="w-28 bg-slate-800 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-indigo-500 h-2 rounded-full transition-all duration-500"
                          style={{ width: `${wf.progress}%` }}
                        />
                      </div>
                    </div>

                    <button
                      onClick={() => setExpandedWfId(isExpanded ? null : wf.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5"
                    >
                      {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </button>
                    <button
                      onClick={() => handleDeleteWorkflow(wf.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10"
                      title="Delete Application"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Recommended Next Action Banner */}
                {pendingItems.length > 0 && (
                  <div className="mt-4 p-3 rounded-xl bg-indigo-950/40 border border-indigo-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2 text-indigo-200">
                      <Sparkles className="w-4 h-4 text-indigo-400 shrink-0" />
                      <span><strong>Next Recommended Action:</strong> {pendingItems[0].title}</span>
                    </div>
                    <GlassButton
                      variant="primary"
                      size="sm"
                      onClick={() => handleToggleItemStatus(wf.id, pendingItems[0].id, pendingItems[0].status)}
                    >
                      Mark Complete
                    </GlassButton>
                  </div>
                )}

                {/* Expanded Checklist */}
                {isExpanded && (
                  <div className="mt-6 pt-5 border-t border-white/5 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                        Ordered Execution Checklist
                      </span>
                      <span className="text-[11px] text-slate-500">
                        User controls all final submissions
                      </span>
                    </div>

                    <div className="divide-y divide-white/5 border border-white/10 rounded-2xl bg-[#070B14]/40 overflow-hidden">
                      {items.map((item, idx) => {
                        const isDone = item.status === 'completed';
                        return (
                          <div
                            key={item.id}
                            className={`p-3.5 flex items-start justify-between gap-3 text-xs transition-colors ${
                              isDone ? 'bg-slate-900/20 opacity-75' : 'hover:bg-white/5'
                            }`}
                          >
                            <div className="flex items-start gap-3 flex-1">
                              <button
                                onClick={() => handleToggleItemStatus(wf.id, item.id, item.status)}
                                className={`mt-0.5 w-5 h-5 rounded-lg border flex items-center justify-center transition-colors ${
                                  isDone
                                    ? 'bg-emerald-500 border-emerald-400 text-white'
                                    : 'border-slate-600 hover:border-indigo-400'
                                }`}
                              >
                                {isDone && <CheckCircle2 className="w-3.5 h-3.5" />}
                              </button>
                              <div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className={`font-semibold ${isDone ? 'line-through text-slate-400' : 'text-slate-100'}`}>
                                    {idx + 1}. {item.title}
                                  </p>
                                  {item.is_verified ? (
                                    <span className="inline-flex items-center gap-1 text-[9px] bg-emerald-500/15 text-emerald-300 px-1.5 py-0.2 rounded border border-emerald-500/30">
                                      <ShieldCheck className="w-3 h-3" /> Official Requirement
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 text-[9px] bg-indigo-500/10 text-indigo-300 px-1.5 py-0.2 rounded border border-indigo-500/20">
                                      <Sparkles className="w-3 h-3" /> Suggested Step
                                    </span>
                                  )}
                                </div>
                                <p className="text-[11px] text-slate-400 mt-0.5">{item.description}</p>
                                {item.source_reference && (
                                  <p className="text-[10px] text-slate-500 mt-0.5 italic">
                                    Source: {item.source_reference}
                                  </p>
                                )}
                                {item.required_document && (
                                  <div className="mt-1 flex items-center gap-1.5 text-[10px]">
                                    <span className="text-slate-500">Document:</span>
                                    <span className="px-1.5 py-0.2 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                                      {item.required_document}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>

                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded capitalize shrink-0 ${
                              isDone ? 'bg-emerald-500/10 text-emerald-300' : 'bg-slate-800 text-slate-400'
                            }`}>
                              {item.status}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </GlassCard>
            );
          })}
        </div>
      )}

      {/* Propose & Confirm Application Modal */}
      <GlassModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={proposal ? "Review & Confirm Application Proposal" : "Start New Application"}
        description={
          proposal
            ? "Verify the inferred category, official requirements, and matching Smart Memory records."
            : "Enter any legitimate application goal (e.g. Master's Admission, Software Engineer Job, Auto Insurance Claim, Visa, Loan, or Rental)."
        }
        maxWidth="max-w-2xl"
      >
        {!proposal ? (
          <form onSubmit={(e) => { e.preventDefault(); handleGenerateProposal(); }} className="space-y-4">
            <GlassInput
              label="Application Goal"
              placeholder="e.g. Apply for Master of Science in AI at Stanford, or File Geico auto insurance claim"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              required
            />
            <GlassInput
              label="Target Authority, Institution, or Employer (Optional)"
              placeholder="e.g. Stanford Admissions, Google HR, Geico Claims, French Consulate"
              value={institution}
              onChange={(e) => setInstitution(e.target.value)}
            />

            <div className="p-3.5 rounded-xl bg-slate-900/60 border border-white/5 text-[11px] text-slate-400 space-y-1">
              <p className="font-semibold text-slate-300">Orbi General-Purpose Companion Capabilities:</p>
              <p>• Automatically infers category from 11 application domains (with user override).</p>
              <p>• Searches Smart Memory for uploaded guideline PDFs to extract verified official requirements.</p>
              <p>• Clearly distinguishes verified requirements from standard practice suggestions.</p>
              <p>• Asks clarifying questions if deadlines or critical information are missing.</p>
              <p>• User always reviews and confirms before workflow and tracking tasks are created.</p>
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <GlassButton
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setModalOpen(false)}
              >
                Cancel
              </GlassButton>
              <GlassButton
                type="submit"
                variant="primary"
                size="sm"
                loading={proposing}
                icon={<Sparkles className="w-4 h-4 ml-1" />}
              >
                Analyze & Propose Checklist
              </GlassButton>
            </div>
          </form>
        ) : (
          <div className="space-y-4 animate-in fade-in">
            {/* Category Selector Banner */}
            <div className="p-3 rounded-xl bg-slate-900/80 border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <Tag className="w-4 h-4 text-indigo-400" />
                <span className="text-slate-400">Inferred Category:</span>
                <span className={`px-2 py-0.5 rounded font-bold uppercase text-[10px] border ${getCategoryBadgeColor(proposal.category)}`}>
                  {proposal.category_label}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-400">Change Category:</span>
                <select
                  value={selectedCategory || proposal.category}
                  onChange={(e) => handleCategorySwitch(e.target.value)}
                  className="bg-[#0B1120] text-slate-200 text-xs px-2.5 py-1 rounded-lg border border-white/10 focus:outline-none focus:border-indigo-500/50"
                >
                  {(proposal.supported_categories || []).map((cat: any) => (
                    <option key={cat.key} value={cat.key}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Recommendation & Overview */}
            <div className="p-3 rounded-xl bg-indigo-950/40 border border-indigo-500/20 text-xs text-indigo-200">
              {proposal.recommendation}
            </div>

            {/* Clarifying Questions Notice */}
            {proposal.clarifying_questions && proposal.clarifying_questions.length > 0 && (
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 space-y-2">
                <div className="flex items-center gap-2 text-amber-300 text-xs font-semibold">
                  <HelpCircle className="w-4 h-4 shrink-0" />
                  <span>Clarifying Questions (Missing Information)</span>
                </div>
                <div className="space-y-1 text-xs text-amber-200/90 pl-6">
                  {proposal.clarifying_questions.map((cq: any, idx: number) => (
                    <p key={idx}>• {cq.question}</p>
                  ))}
                </div>
              </div>
            )}

            {/* Deadline Input / Edit */}
            <div className="p-3 rounded-xl bg-slate-900/60 border border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 text-slate-300">
                <Calendar className="w-4 h-4 text-indigo-400" />
                <span>Target Deadline / Submission Cutoff:</span>
                {proposal.is_deadline_verified && (
                  <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/20">
                    Official ({proposal.deadline_source})
                  </span>
                )}
              </div>
              <input
                type="text"
                placeholder="e.g. December 15, 2026 or Fall 2027"
                value={customDeadline}
                onChange={(e) => setCustomDeadline(e.target.value)}
                className="bg-[#0B1120] text-slate-100 text-xs px-3 py-1.5 rounded-lg border border-white/10 focus:outline-none focus:border-indigo-400/50 w-full sm:w-64"
              />
            </div>

            {/* Metrics Breakdown */}
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-300 px-1">
              <span>Total Tasks: <strong>{proposal.total_requirements}</strong></span>
              <span className="text-emerald-400">
                <strong>{proposal.verified_requirements_count || 0}</strong> Official Verified
              </span>
              <span className="text-indigo-400">
                <strong>{proposal.suggested_requirements_count || 0}</strong> Standard Suggestions
              </span>
              <span className="text-emerald-400">
                <strong>{proposal.matched_count}</strong> In Vault
              </span>
              <span className="text-amber-400">
                <strong>{proposal.missing_documents.length}</strong> Missing
              </span>
            </div>

            {/* Checklist Items Preview */}
            <div className="divide-y divide-white/5 border border-white/10 rounded-xl bg-[#070B14]/40 max-h-60 overflow-y-auto">
              {proposal.checklist_proposal.map((item: any, idx: number) => (
                <div key={idx} className="p-2.5 text-xs flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-slate-200 truncate">{idx + 1}. {item.title}</p>
                      {item.is_verified ? (
                        <span className="text-[9px] text-emerald-300 bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/20 shrink-0">
                          Official Requirement
                        </span>
                      ) : (
                        <span className="text-[9px] text-slate-400 bg-slate-800 px-1.5 py-0.2 rounded shrink-0">
                          Suggestion
                        </span>
                      )}
                    </div>
                    {item.source_reference && (
                      <p className="text-[10px] text-slate-500 italic mt-0.5 truncate">
                        {item.source_reference}
                      </p>
                    )}
                  </div>
                  {item.matched_document_name ? (
                    <span className="text-[10px] text-emerald-300 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 shrink-0">
                      Matched
                    </span>
                  ) : (
                    <span className="text-[10px] text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 shrink-0">
                      Missing Doc
                    </span>
                  )}
                </div>
              ))}
            </div>

            {/* Modal Controls */}
            <div className="pt-3 border-t border-white/5 flex items-center justify-between">
              <GlassButton
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setProposal(null)}
              >
                Back to Edit
              </GlassButton>
              <GlassButton
                type="button"
                variant="primary"
                size="sm"
                loading={confirming}
                onClick={handleConfirmWorkflow}
                icon={<CheckCircle2 className="w-4 h-4 ml-1" />}
              >
                Confirm & Create Workflow
              </GlassButton>
            </div>
          </div>
        )}
      </GlassModal>
    </div>
  );
};
