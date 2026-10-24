import React, { useState, useEffect } from 'react';
import {
  Calendar as CalendarIcon,
  Plus,
  Clock,
  Bell,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  ChevronRight
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
import { calendarApi } from '../services/api';
import { formatDateTimeDMY } from '../utils/dateUtils';

export const CalendarPage: React.FC = () => {
  const [events, setEvents] = useState<any[]>([]);
  const [reminders, setReminders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'appointments' | 'milestones' | 'reminders'>('all');

  const getTodayDateStr = () => new Date().toISOString().split('T')[0];

  // New Event Modal
  const [eventModalOpen, setEventModalOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [eventType, setEventType] = useState('appointment');
  const [eventDate, setEventDate] = useState(getTodayDateStr());
  const [eventTime, setEventTime] = useState('09:00');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [createReminder, setCreateReminder] = useState(true);
  const [advanceMinutes, setAdvanceMinutes] = useState('60');
  const [savingEvent, setSavingEvent] = useState(false);

  // New Reminder Modal
  const [reminderModalOpen, setReminderModalOpen] = useState(false);
  const [remTitle, setRemTitle] = useState('');
  const [remDate, setRemDate] = useState(getTodayDateStr());
  const [remTime, setRemTime] = useState('09:00');
  const [savingRem, setSavingRem] = useState(false);

  const fetchCalendarData = async () => {
    setLoading(true);
    setError('');
    try {
      const [evData, remData] = await Promise.all([
        calendarApi.getEvents(),
        calendarApi.getReminders()
      ]);
      setEvents(evData);
      setReminders(remData);
    } catch (err: any) {
      setError(err.message || 'Failed to load calendar');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCalendarData();
  }, []);

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !eventDate) return;

    const timePart = eventTime || '09:00';
    const computedStartTime = `${eventDate}T${timePart.length === 5 ? timePart + ':00' : timePart}`;

    setSavingEvent(true);
    try {
      await calendarApi.createEvent({
        title,
        event_type: eventType,
        start_time: computedStartTime,
        location,
        notes,
        create_reminder: createReminder,
        advance_minutes: parseInt(advanceMinutes, 10)
      });
      setEventModalOpen(false);
      setTitle('');
      setEventDate(getTodayDateStr());
      setEventTime('09:00');
      setLocation('');
      setNotes('');
      fetchCalendarData();
    } catch (err: any) {
      alert(err.message || 'Failed to create event');
    } finally {
      setSavingEvent(false);
    }
  };

  const handleCreateReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!remTitle || !remDate) return;

    const timePart = remTime || '09:00';
    const computedDueTime = `${remDate}T${timePart.length === 5 ? timePart + ':00' : timePart}`;

    setSavingRem(true);
    try {
      await calendarApi.createReminder({
        title: remTitle,
        due_time: computedDueTime,
        reminder_type: 'one_time'
      });
      setReminderModalOpen(false);
      setRemTitle('');
      setRemDate(getTodayDateStr());
      setRemTime('09:00');
      fetchCalendarData();
    } catch (err: any) {
      alert(err.message || 'Failed to create reminder');
    } finally {
      setSavingRem(false);
    }
  };

  const handleSnooze = async (id: string, mins: number) => {
    try {
      await calendarApi.snoozeReminder(id, mins);
      fetchCalendarData();
    } catch (err: any) {
      alert(err.message || 'Failed to snooze reminder');
    }
  };

  const handleDismiss = async (id: string) => {
    try {
      await calendarApi.dismissReminder(id);
      fetchCalendarData();
    } catch (err: any) {
      alert(err.message || 'Failed to dismiss reminder');
    }
  };

  const handleDeleteEvent = async (id: string) => {
    if (!window.confirm('Delete this event?')) return;
    try {
      await calendarApi.deleteEvent(id);
      fetchCalendarData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete');
    }
  };

  const filteredEvents = events.filter(e => {
    if (activeTab === 'appointments') return e.event_type === 'appointment';
    if (activeTab === 'milestones') return e.event_type === 'birthday' || e.event_type === 'anniversary';
    return true;
  });

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-white/5">
        <div>
          <div className="flex items-center gap-2 text-indigo-400 text-xs font-semibold uppercase tracking-wider mb-1">
            <CalendarIcon className="w-4 h-4" />
            <span>Schedule & Persistent Worker</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white font-['Manrope']">
            Calendar & Reminders
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Unified view of family birthdays, appointments, bill due dates, and persistent backend reminders.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <GlassButton
            variant="secondary"
            size="sm"
            icon={<Bell className="w-4 h-4" />}
            onClick={() => setReminderModalOpen(true)}
          >
            New Reminder
          </GlassButton>
          <GlassButton
            variant="primary"
            size="sm"
            icon={<Plus className="w-4 h-4" />}
            onClick={() => setEventModalOpen(true)}
          >
            Add Event
          </GlassButton>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-white/5 pb-2">
        {[
          { key: 'all', label: 'All Events' },
          { key: 'appointments', label: 'Appointments' },
          { key: 'milestones', label: 'Birthdays & Milestones' },
          { key: 'reminders', label: `Active Reminders (${reminders.filter(r => r.status === 'scheduled').length})` }
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
              activeTab === tab.key
                ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <LoadingState message="Syncing calendar schedule and persistent worker..." />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchCalendarData} />
      ) : activeTab === 'reminders' ? (
        /* REMINDERS LIST */
        <div className="space-y-3">
          {reminders.length === 0 ? (
            <EmptyState
              icon={<Bell className="w-8 h-8 text-indigo-400" />}
              title="No Reminders Scheduled"
              description="Persistent reminders trigger via background worker even when your browser is closed."
              action={{
                label: "Set a Reminder",
                onClick: () => setReminderModalOpen(true)
              }}
            />
          ) : (
            reminders.map(rem => (
              <GlassCard key={rem.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${
                    rem.status === 'scheduled'
                      ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400'
                      : rem.status === 'sent'
                      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                      : 'bg-slate-800 border-white/5 text-slate-500'
                  }`}>
                    <Bell className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-semibold text-slate-100">{rem.title}</h4>
                      <span className="text-[10px] font-semibold px-2 py-0.2 rounded capitalize bg-slate-800 text-slate-300">
                        {rem.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Due: {formatDateTimeDMY(rem.due_time)} {rem.advance_minutes ? `(${rem.advance_minutes}m notice)` : ''}
                    </p>
                  </div>
                </div>

                {rem.status === 'scheduled' && (
                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    <GlassButton
                      variant="outline"
                      size="sm"
                      onClick={() => handleSnooze(rem.id, 15)}
                    >
                      Snooze 15m
                    </GlassButton>
                    <GlassButton
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDismiss(rem.id)}
                    >
                      Dismiss
                    </GlassButton>
                  </div>
                )}
              </GlassCard>
            ))
          )}
        </div>
      ) : (
        /* EVENTS LIST */
        <div className="space-y-3">
          {filteredEvents.length === 0 ? (
            <EmptyState
              icon={<CalendarIcon className="w-8 h-8 text-indigo-400" />}
              title="No Events Found"
              description="Add your appointments, doctor visits, or family milestones."
              action={{
                label: "Add an Event",
                onClick: () => setEventModalOpen(true)
              }}
            />
          ) : (
            filteredEvents.map(event => (
              <GlassCard key={event.id} className="p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                    event.event_type === 'birthday'
                      ? 'bg-purple-500/10 border-purple-500/20 text-purple-300'
                      : event.event_type === 'anniversary'
                      ? 'bg-rose-500/10 border-rose-500/20 text-rose-300'
                      : 'bg-indigo-500/10 border-indigo-500/20 text-indigo-300'
                  }`}>
                    <CalendarIcon className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-semibold text-slate-100">{event.title}</h4>
                      <span className="text-[10px] font-semibold px-2 py-0.2 rounded capitalize bg-slate-800 text-slate-300">
                        {event.event_type}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {formatDateTimeDMY(event.start_time)} {event.location ? `• ${event.location}` : ''} {event.notes ? `• ${event.notes}` : ''}
                    </p>
                  </div>
                </div>

                {!event.is_synthetic && (
                  <button
                    onClick={() => handleDeleteEvent(event.id)}
                    className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg"
                    title="Delete Event"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </GlassCard>
            ))
          )}
        </div>
      )}

      {/* Add Event Modal */}
      <GlassModal
        isOpen={eventModalOpen}
        onClose={() => setEventModalOpen(false)}
        title="Schedule New Event / Appointment"
        description="Add to your personal agenda with optional persistent reminder."
      >
        <form onSubmit={handleCreateEvent} className="space-y-4">
          <GlassInput
            label="Event Title"
            placeholder="e.g. Annual Health Checkup, Dentist, Tax Consultation"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-slate-300">Event Type</label>
              <select
                value={eventType}
                onChange={(e) => setEventType(e.target.value)}
                className="bg-[#0B1120]/70 text-slate-100 rounded-xl border border-white/10 px-3.5 py-2 text-sm focus:outline-none"
              >
                <option value="appointment">Appointment</option>
                <option value="birthday">Birthday</option>
                <option value="anniversary">Anniversary</option>
                <option value="deadline">Task Deadline</option>
                <option value="custom">General Event</option>
              </select>
            </div>
            <GlassInput
              label="Date"
              type="date"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
              required
            />
            <GlassInput
              label="Time"
              type="time"
              value={eventTime}
              onChange={(e) => setEventTime(e.target.value)}
              required
            />
          </div>

          <GlassInput
            label="Location (Optional)"
            placeholder="e.g. 100 Main St Suite 400 or Zoom Link"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          />

          <GlassInput
            label="Notes / Preparation Details"
            placeholder="e.g. Fasting required 8 hours prior"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />

          <div className="p-3.5 rounded-xl bg-slate-900/60 border border-white/5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300">Schedule Persistent Reminder</span>
              <input
                type="checkbox"
                checked={createReminder}
                onChange={(e) => setCreateReminder(e.target.checked)}
                className="w-4 h-4 rounded accent-indigo-600"
              />
            </div>
            {createReminder && (
              <div className="flex items-center justify-between pt-2 border-t border-white/5">
                <span className="text-[11px] text-slate-400">Advance Notice</span>
                <select
                  value={advanceMinutes}
                  onChange={(e) => setAdvanceMinutes(e.target.value)}
                  className="bg-slate-900 text-slate-200 text-xs px-2.5 py-1 rounded border border-white/10"
                >
                  <option value="15">15 Minutes Before</option>
                  <option value="60">1 Hour Before</option>
                  <option value="1440">1 Day Before</option>
                </select>
              </div>
            )}
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <GlassButton
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setEventModalOpen(false)}
            >
              Cancel
            </GlassButton>
            <GlassButton
              type="submit"
              variant="primary"
              size="sm"
              loading={savingEvent}
            >
              Save Event
            </GlassButton>
          </div>
        </form>
      </GlassModal>

      {/* Add Reminder Modal */}
      <GlassModal
        isOpen={reminderModalOpen}
        onClose={() => setReminderModalOpen(false)}
        title="Schedule Persistent Reminder"
        description="Will alert you via the persistent scheduler."
      >
        <form onSubmit={handleCreateReminder} className="space-y-4">
          <GlassInput
            label="Reminder Title"
            placeholder="e.g. Call embassy to verify visa receipt"
            value={remTitle}
            onChange={(e) => setRemTitle(e.target.value)}
            required
          />
          <div className="grid grid-cols-2 gap-3">
            <GlassInput
              label="Date"
              type="date"
              value={remDate}
              onChange={(e) => setRemDate(e.target.value)}
              required
            />
            <GlassInput
              label="Time"
              type="time"
              value={remTime}
              onChange={(e) => setRemTime(e.target.value)}
              required
            />
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <GlassButton
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setReminderModalOpen(false)}
            >
              Cancel
            </GlassButton>
            <GlassButton
              type="submit"
              variant="primary"
              size="sm"
              loading={savingRem}
            >
              Set Reminder
            </GlassButton>
          </div>
        </form>
      </GlassModal>
    </div>
  );
};
