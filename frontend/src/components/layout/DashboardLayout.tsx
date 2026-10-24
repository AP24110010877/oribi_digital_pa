import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { Menu, Bell, Search, Sparkles, Check } from 'lucide-react';
import { AppSidebar } from './AppSidebar';
import { authApi, briefingApi } from '../../services/api';

export const DashboardLayout: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    async function loadSession() {
      try {
        const session = await authApi.getSession();
        setUserProfile(session.profile);
        // Load notifications
        const notifs = await briefingApi.getNotifications();
        setNotifications(notifs);
      } catch (err) {
        console.error('Session load error', err);
        // If we can't reach the backend or session is invalid, redirect to login
        navigate('/login');
      } finally {
        setLoading(false);
      }
    }
    loadSession();
  }, [navigate]);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const markAllRead = async () => {
    for (const n of notifications.filter(n => !n.is_read)) {
      try {
        await briefingApi.markRead(n.id);
      } catch (e) {}
    }
    setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
  };

  return (
    <div className="min-h-screen bg-[#070B14] text-slate-100 flex flex-col md:flex-row">
      {/* Sidebar */}
      <AppSidebar
        userProfile={userProfile}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 md:pl-64 flex flex-col min-h-screen">
        {/* Top Navbar */}
        <header className="sticky top-0 z-20 h-16 bg-[#070B14]/80 backdrop-blur-xl border-b border-white/5 px-4 md:px-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/60 border border-white/5 text-xs text-slate-400">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              <span>Orbi AI Assistant Active</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Quick Ask trigger */}
            <button
              onClick={() => navigate('/assistant')}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/15 border border-indigo-500/20 text-indigo-300 text-xs font-medium transition-colors"
            >
              <Search className="w-3.5 h-3.5" />
              <span>Ask Orbi anything...</span>
            </button>

            {/* Notifications Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
                title="Notifications & Smart Alerts"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-indigo-500 shadow-sm shadow-indigo-500/80" />
                )}
              </button>

              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-[#0D1527] border border-white/10 shadow-2xl p-4 z-50">
                  <div className="flex items-center justify-between pb-3 border-b border-white/5">
                    <span className="text-sm font-semibold text-slate-200">Smart Alerts</span>
                    {unreadCount > 0 && (
                      <button
                        onClick={markAllRead}
                        className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                      >
                        <Check className="w-3.5 h-3.5" /> Mark read
                      </button>
                    )}
                  </div>

                  <div className="divide-y divide-white/5 max-h-80 overflow-y-auto mt-2">
                    {notifications.length === 0 ? (
                      <p className="text-xs text-slate-500 py-6 text-center">No alerts at the moment.</p>
                    ) : (
                      notifications.map(n => (
                        <div key={n.id} className="py-2.5 px-2 hover:bg-white/5 rounded-lg transition-colors">
                          <p className="text-xs font-medium text-slate-200">{n.title}</p>
                          <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">{n.message}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page View */}
        <main className="flex-1 p-4 md:p-8 max-w-7xl w-full mx-auto">
          <Outlet context={{ userProfile, setUserProfile }} />
        </main>
      </div>
    </div>
  );
};
