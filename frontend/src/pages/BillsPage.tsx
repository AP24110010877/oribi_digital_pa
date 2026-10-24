import React, { useState, useEffect } from 'react';
import {
  Receipt,
  Plus,
  CheckCircle2,
  Clock,
  AlertCircle,
  Trash2,
  FileText,
  DollarSign,
  ArrowUpDown,
  Filter
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
import { billApi } from '../services/api';
import { formatDateDMY } from '../utils/dateUtils';

export const formatRupees = (amount: number | string, currency: string = 'INR') => {
  const num = Number(amount || 0);
  const symbol = currency === 'INR' ? '₹' : currency === 'USD' ? '$' : currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : `${currency} `;
  return `${symbol}${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export const BillsPage: React.FC = () => {
  const [bills, setBills] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  // Create/Edit Bill Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingBill, setEditingBill] = useState<any>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formBiller, setFormBiller] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formCurrency, setFormCurrency] = useState('INR');
  const [formDueDate, setFormDueDate] = useState('');
  const [formAdvanceDays, setFormAdvanceDays] = useState('3');
  const [saving, setSaving] = useState(false);

  const fetchBills = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await billApi.list(filterStatus === 'all' ? undefined : filterStatus);
      setBills(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load bills');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBills();
  }, [filterStatus]);

  const handleOpenCreate = () => {
    setEditingBill(null);
    setFormTitle('');
    setFormBiller('');
    setFormAmount('');
    setFormCurrency('INR');
    setFormDueDate('');
    setFormAdvanceDays('3');
    setModalOpen(true);
  };

  const handleOpenEdit = (bill: any) => {
    setEditingBill(bill);
    setFormTitle(bill.title);
    setFormBiller(bill.biller);
    setFormAmount(bill.amount.toString());
    setFormCurrency(bill.currency || 'INR');
    setFormDueDate(bill.due_date);
    setFormAdvanceDays(bill.advance_reminder_days?.toString() || '3');
    setModalOpen(true);
  };

  const handleSubmitBill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle || !formAmount || !formDueDate) return;

    setSaving(true);
    try {
      const payload = {
        title: formTitle,
        biller: formBiller || formTitle,
        amount: parseFloat(formAmount),
        currency: formCurrency,
        due_date: formDueDate,
        advance_reminder_days: parseInt(formAdvanceDays, 10) || 3
      };

      if (editingBill) {
        await billApi.update(editingBill.id, payload);
      } else {
        await billApi.create(payload);
      }
      setModalOpen(false);
      fetchBills();
    } catch (err: any) {
      alert(err.message || 'Failed to save bill');
    } finally {
      setSaving(false);
    }
  };

  const handleStatusToggle = async (billId: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'paid' ? 'upcoming' : 'paid';
    try {
      const res = await billApi.updateStatus(billId, nextStatus);
      fetchBills();
    } catch (err: any) {
      alert(err.message || 'Failed to update status');
    }
  };

  const handleDeleteBill = async (billId: string) => {
    if (!window.confirm('Delete this bill record?')) return;
    try {
      await billApi.delete(billId);
      fetchBills();
    } catch (err: any) {
      alert(err.message || 'Failed to delete');
    }
  };

  const totalUpcoming = bills
    .filter(b => b.status !== 'paid')
    .reduce((sum, b) => sum + Number(b.amount || 0), 0);

  const totalPaid = bills
    .filter(b => b.status === 'paid')
    .reduce((sum, b) => sum + Number(b.amount || 0), 0);

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-white/5">
        <div>
          <div className="flex items-center gap-2 text-indigo-400 text-xs font-semibold uppercase tracking-wider mb-1">
            <Receipt className="w-4 h-4" />
            <span>Financial Deadlines</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white font-['Manrope']">
            Bills & Payments
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Track obligations, configure persistent advance reminders, and manually record payment status. No bank transactions occur without explicit integration.
          </p>
        </div>

        <GlassButton
          variant="primary"
          icon={<Plus className="w-4 h-4" />}
          onClick={handleOpenCreate}
        >
          Add Bill
        </GlassButton>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <GlassCard className="p-5">
          <span className="text-xs font-medium text-slate-400">Total Pending Bills</span>
          <p className="text-2xl font-bold text-white font-['Manrope'] mt-1">
            {formatRupees(totalUpcoming, 'INR')}
          </p>
          <span className="text-[11px] text-amber-400 mt-1 block">
            {bills.filter(b => b.status !== 'paid').length} bills due
          </span>
        </GlassCard>

        <GlassCard className="p-5">
          <span className="text-xs font-medium text-slate-400">Marked as Paid</span>
          <p className="text-2xl font-bold text-white font-['Manrope'] mt-1">
            {formatRupees(totalPaid, 'INR')}
          </p>
          <span className="text-[11px] text-emerald-400 mt-1 block">
            {bills.filter(b => b.status === 'paid').length} bills settled
          </span>
        </GlassCard>

        <GlassCard className="p-5">
          <span className="text-xs font-medium text-slate-400">Advance Reminders</span>
          <p className="text-2xl font-bold text-white font-['Manrope'] mt-1">
            Active
          </p>
          <span className="text-[11px] text-indigo-400 mt-1 block">
            Persistent background scheduler running
          </span>
        </GlassCard>
      </div>

      {/* Status Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-white/5 pb-2">
        {['all', 'upcoming', 'overdue', 'paid'].map(status => (
          <button
            key={status}
            onClick={() => setFilterStatus(status)}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium capitalize transition-all ${
              filterStatus === status
                ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {status}
          </button>
        ))}
      </div>

      {/* Bills List */}
      {loading ? (
        <LoadingState message="Fetching bills and schedule..." />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchBills} />
      ) : bills.length === 0 ? (
        <EmptyState
          icon={<Receipt className="w-8 h-8 text-indigo-400" />}
          title="No Bills Tracked"
          description="Add your utility, subscription, or insurance bills to receive persistent advance alerts."
          action={{
            label: "Add Your First Bill",
            onClick: handleOpenCreate
          }}
        />
      ) : (
        <div className="space-y-3">
          {bills.map(bill => {
            const isPaid = bill.status === 'paid';
            const isOverdue = bill.status === 'overdue';

            return (
              <GlassCard
                key={bill.id}
                className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all ${
                  isPaid ? 'opacity-75' : ''
                }`}
              >
                <div className="flex items-center gap-3.5">
                  <button
                    onClick={() => handleStatusToggle(bill.id, bill.status)}
                    className={`w-6 h-6 rounded-lg border flex items-center justify-center transition-colors ${
                      isPaid
                        ? 'bg-emerald-500 border-emerald-400 text-white'
                        : 'border-slate-600 hover:border-indigo-400'
                    }`}
                    title={isPaid ? "Mark as Upcoming" : "Mark as Paid"}
                  >
                    {isPaid && <CheckCircle2 className="w-4 h-4" />}
                  </button>

                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className={`text-sm font-semibold ${isPaid ? 'line-through text-slate-400' : 'text-slate-100'}`}>
                        {bill.title}
                      </h4>
                      <span className={`text-[10px] font-semibold px-2 py-0.2 rounded capitalize ${
                        isPaid
                          ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/20'
                          : isOverdue
                          ? 'bg-rose-500/15 text-rose-300 border border-rose-500/20'
                          : 'bg-amber-500/15 text-amber-300 border border-amber-500/20'
                      }`}>
                        {bill.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Biller: <span className="text-slate-300">{bill.biller}</span> • Due Date: <span className="text-slate-300">{formatDateDMY(bill.due_date)}</span> {bill.notes ? `• ${bill.notes}` : ''}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-4 self-end sm:self-auto">
                  <span className="text-base font-bold text-white font-['Manrope']">
                    {formatRupees(bill.amount, bill.currency || 'INR')}
                  </span>

                  <div className="flex items-center gap-1.5">
                    <GlassButton
                      variant="ghost"
                      size="sm"
                      onClick={() => handleOpenEdit(bill)}
                    >
                      Edit
                    </GlassButton>
                    <button
                      onClick={() => handleDeleteBill(bill.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg"
                      title="Delete Bill"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </GlassCard>
            );
          })}
        </div>
      )}

      {/* Bill Modal */}
      <GlassModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingBill ? "Edit Bill Details" : "Track New Bill"}
        description="Configure amounts, due dates, and advance notification schedule."
      >
        <form onSubmit={handleSubmitBill} className="space-y-4">
          <GlassInput
            label="Bill Title"
            placeholder="e.g. Electric Utility Statement"
            value={formTitle}
            onChange={(e) => setFormTitle(e.target.value)}
            required
          />

          <GlassInput
            label="Biller / Vendor"
            placeholder="e.g. Con Edison, Spotify, State Farm"
            value={formBiller}
            onChange={(e) => setFormBiller(e.target.value)}
          />

          <div className="grid grid-cols-2 gap-3">
            <GlassInput
              label="Amount"
              type="number"
              step="0.01"
              placeholder="0.00"
              value={formAmount}
              onChange={(e) => setFormAmount(e.target.value)}
              required
            />
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-slate-300">Currency</label>
              <select
                value={formCurrency}
                onChange={(e) => setFormCurrency(e.target.value)}
                className="bg-[#0B1120]/70 text-slate-100 rounded-xl border border-white/10 px-3.5 py-2 text-sm focus:outline-none"
              >
                <option value="INR">INR (₹ Rupees)</option>
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
                <option value="CAD">CAD ($)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <GlassInput
              label="Due Date"
              type="date"
              value={formDueDate}
              onChange={(e) => setFormDueDate(e.target.value)}
              required
            />
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-slate-300">Advance Reminder</label>
              <select
                value={formAdvanceDays}
                onChange={(e) => setFormAdvanceDays(e.target.value)}
                className="bg-[#0B1120]/70 text-slate-100 rounded-xl border border-white/10 px-3.5 py-2 text-sm focus:outline-none"
              >
                <option value="1">1 Day Before</option>
                <option value="3">3 Days Before</option>
                <option value="7">1 Week Before</option>
              </select>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-900/60 border border-white/5 text-[11px] text-slate-400">
            Note: Marking this bill as paid updates your personal records. It does not trigger external bank transfers.
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
              loading={saving}
            >
              {editingBill ? "Save Changes" : "Create Bill"}
            </GlassButton>
          </div>
        </form>
      </GlassModal>
    </div>
  );
};
