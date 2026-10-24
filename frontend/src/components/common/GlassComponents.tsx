import React from 'react';
import { Loader2, AlertCircle, Inbox, X } from 'lucide-react';

// GlassCard
export interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'subtle' | 'glow' | 'interactive';
  children: React.ReactNode;
}

export const GlassCard: React.FC<GlassCardProps> = ({
  variant = 'default',
  className = '',
  children,
  ...props
}) => {
  const base = "rounded-2xl transition-all duration-200 border";
  const variants = {
    default: "bg-[#0F172A]/60 backdrop-blur-md border-white/8 shadow-lg shadow-black/20",
    subtle: "bg-[#0F172A]/40 backdrop-blur-sm border-white/5",
    glow: "bg-[#0F172A]/70 backdrop-blur-lg border-indigo-500/25 shadow-xl shadow-indigo-500/5",
    interactive: "bg-[#0F172A]/60 backdrop-blur-md border-white/8 hover:border-indigo-400/30 hover:bg-[#131D36]/80 hover:shadow-xl hover:shadow-indigo-500/10 cursor-pointer",
  };

  return (
    <div className={`${base} ${variants[variant]} ${className}`} {...props}>
      {children}
    </div>
  );
};

// GlassPanel
export const GlassPanel: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className = '',
  children,
  ...props
}) => {
  return (
    <div
      className={`rounded-3xl bg-[#0D1527]/70 backdrop-blur-xl border border-white/10 shadow-2xl shadow-black/40 p-6 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

// GlassButton
export interface GlassButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: React.ReactNode;
}

export const GlassButton: React.FC<GlassButtonProps> = ({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  className = '',
  children,
  disabled,
  ...props
}) => {
  const base = "inline-flex items-center justify-center font-medium rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 disabled:opacity-50 disabled:cursor-not-allowed select-none";

  const sizes = {
    sm: "px-3 py-1.5 text-xs gap-1.5",
    md: "px-4 py-2 text-sm gap-2",
    lg: "px-6 py-3 text-base gap-2.5",
  };

  const variants = {
    primary: "bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 border border-indigo-400/30 active:scale-[0.98]",
    secondary: "bg-slate-800/80 hover:bg-slate-700/80 text-slate-100 border border-white/10 shadow-sm active:scale-[0.98]",
    outline: "bg-transparent hover:bg-white/5 text-slate-200 border border-slate-700/60 active:scale-[0.98]",
    ghost: "bg-transparent hover:bg-white/5 text-slate-300 hover:text-white",
    danger: "bg-rose-600/80 hover:bg-rose-600 text-white border border-rose-500/40 shadow-lg shadow-rose-600/20 active:scale-[0.98]",
  };

  return (
    <button
      className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : icon}
      {children}
    </button>
  );
};

// GlassInput
export interface GlassInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
}

export const GlassInput: React.FC<GlassInputProps> = ({
  label,
  error,
  icon,
  className = '',
  id,
  ...props
}) => {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className="w-full flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-xs font-medium text-slate-300 flex items-center justify-between">
          <span>{label}</span>
          {props.required && <span className="text-indigo-400 text-xs">*</span>}
        </label>
      )}
      <div className="relative flex items-center">
        {icon && (
          <div className="absolute left-3 text-slate-400 pointer-events-none">
            {icon}
          </div>
        )}
        <input
          id={inputId}
          className={`w-full bg-[#0B1120]/70 text-slate-100 placeholder-slate-500 rounded-xl border ${
            error ? 'border-rose-500/60 focus:ring-rose-500/20' : 'border-white/10 focus:border-indigo-400/40 focus:ring-indigo-500/20'
          } px-3.5 py-2 text-sm focus:outline-none focus:ring-4 backdrop-blur-sm transition-all duration-200 ${
            icon ? 'pl-9' : ''
          } ${className}`}
          {...props}
        />
      </div>
      {error && <span className="text-xs text-rose-400 mt-0.5">{error}</span>}
    </div>
  );
};

// GlassModal
export interface GlassModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  maxWidth?: string;
  children: React.ReactNode;
}

export const GlassModal: React.FC<GlassModalProps> = ({
  isOpen,
  onClose,
  title,
  description,
  maxWidth = 'max-w-lg',
  children,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-md transition-opacity animate-in fade-in"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div
        className={`relative w-full ${maxWidth} rounded-2xl bg-[#0D1527]/95 border border-white/10 shadow-2xl shadow-black/60 backdrop-blur-2xl p-6 z-10 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto`}
      >
        <div className="flex items-center justify-between pb-4 border-b border-white/5">
          <div>
            {title && <h3 className="text-lg font-semibold text-slate-100">{title}</h3>}
            {description && <p className="text-xs text-slate-400 mt-0.5">{description}</p>}
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:text-slate-100 hover:bg-white/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
};

// LoadingState
export const LoadingState: React.FC<{ message?: string; className?: string }> = ({
  message = "Loading your information...",
  className = "py-16",
}) => {
  return (
    <div className={`flex flex-col items-center justify-center gap-3 text-center ${className}`}>
      <div className="relative">
        <div className="w-10 h-10 rounded-full border-2 border-indigo-500/20 border-t-indigo-500 animate-spin" />
        <div className="absolute inset-0 rounded-full blur-sm bg-indigo-500/20" />
      </div>
      <p className="text-sm font-medium text-slate-400 animate-pulse">{message}</p>
    </div>
  );
};

// EmptyState
export const EmptyState: React.FC<{
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}> = ({ icon, title, description, action, className = "py-12" }) => {
  return (
    <div className={`flex flex-col items-center justify-center text-center px-4 ${className}`}>
      <div className="w-12 h-12 rounded-2xl bg-indigo-950/40 border border-indigo-800/30 flex items-center justify-center text-indigo-400 mb-3 shadow-inner">
        {icon || <Inbox className="w-6 h-6" />}
      </div>
      <h4 className="text-base font-medium text-slate-200">{title}</h4>
      <p className="text-xs text-slate-400 max-w-sm mt-1 mb-4 leading-relaxed">{description}</p>
      {action && (
        <GlassButton variant="primary" size="sm" onClick={action.onClick}>
          {action.label}
        </GlassButton>
      )}
    </div>
  );
};

// ErrorState
export const ErrorState: React.FC<{
  title?: string;
  message: string;
  onRetry?: () => void;
  className?: string;
}> = ({
  title = "Something went wrong",
  message,
  onRetry,
  className = "p-4 my-4",
}) => {
  return (
    <div className={`rounded-xl border border-rose-500/30 bg-rose-950/30 backdrop-blur-md flex items-start gap-3 ${className}`}>
      <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
      <div className="flex-1 text-left">
        <h5 className="text-sm font-semibold text-rose-200">{title}</h5>
        <p className="text-xs text-rose-300/80 mt-0.5">{message}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="mt-2 text-xs font-medium text-rose-300 hover:text-white underline underline-offset-2"
          >
            Try again
          </button>
        )}
      </div>
    </div>
  );
};
