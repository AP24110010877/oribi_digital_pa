import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  FolderOpen,
  Sparkles,
  Receipt,
  Calendar,
  MessageSquare,
  Settings,
  LogOut,
  Compass,
  CheckCircle2,
  X
} from 'lucide-react';
import { authApi, clearAuthToken } from '../../services/api';

interface AppSidebarProps {
  userProfile?: any;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const AppSidebar: React.FC<AppSidebarProps> = ({
  userProfile,
  mobileOpen = false,
  onCloseMobile
}) => {
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } catch (e) {
      // Ignore network errors on logout
    }
    clearAuthToken();
    navigate('/');
  };

  const navLinks = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/documents', label: 'Smart Memory', icon: FolderOpen },
    { to: '/applications', label: 'Application Companion', icon: Compass, badge: 'Signature' },
    { to: '/bills', label: 'Bills & Payments', icon: Receipt },
    { to: '/calendar', label: 'Calendar & Reminders', icon: Calendar },
    { to: '/assistant', label: 'Ask Orbi', icon: MessageSquare },
    { to: '/settings', label: 'Settings', icon: Settings },
  ];

  const sidebarContent = (
    <div className="flex flex-col h-full bg-[#090E1C]/90 backdrop-blur-2xl border-r border-white/8 select-none">
      {/* Brand Header */}
      <div className="px-6 py-5 flex items-center justify-between border-b border-white/5">
        <NavLink to="/dashboard" className="flex items-center gap-3 group">
          <div className="relative w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-400 p-[1px] shadow-lg shadow-indigo-600/30">
            <div className="w-full h-full rounded-[11px] bg-[#090E1C] flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-indigo-400 group-hover:scale-110 transition-transform duration-200" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-base tracking-tight text-white font-['Manrope']">Orbi</span>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded border border-indigo-500/20">PA</span>
            </div>
            <p className="text-[10px] text-slate-400 font-medium tracking-wide">A Digital PA</p>
          </div>
        </NavLink>

        {onCloseMobile && (
          <button
            onClick={onCloseMobile}
            className="md:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <div className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          Executive Workspace
        </div>
        {navLinks.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onCloseMobile}
              className={({ isActive }) =>
                `flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group ${
                  isActive
                    ? 'bg-indigo-600/15 text-indigo-300 border border-indigo-500/30 shadow-sm shadow-indigo-500/10'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                }`
              }
            >
              <div className="flex items-center gap-3">
                <Icon className="w-4 h-4 transition-transform duration-150 group-hover:scale-105" />
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span className="text-[9px] font-bold uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 px-1.5 py-0.5 rounded-full">
                  {item.badge}
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* User Profile Card / Session */}
      <div className="p-3 border-t border-white/5 bg-[#070B14]/40">
        <div className="flex items-center justify-between p-2 rounded-xl bg-white/5 border border-white/5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-semibold text-xs shrink-0 shadow">
              {(userProfile?.full_name || 'U').charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-slate-200 truncate">
                {userProfile?.full_name || 'Alex Mercer'}
              </p>
              <p className="text-[10px] text-slate-400 truncate">
                {userProfile?.profession || 'Working Professional'}
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            title="Sign Out"
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:block w-64 h-screen fixed left-0 top-0 z-30">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onCloseMobile} />
          <div className="fixed inset-y-0 left-0 w-72 z-50">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
};
