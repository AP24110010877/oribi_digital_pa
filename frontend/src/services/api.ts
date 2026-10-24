// Orbi API Client

const API_BASE = '/api';

export function getAuthToken(): string {
  return localStorage.getItem('orbi_token') || '';
}

export function setAuthToken(token: string) {
  localStorage.setItem('orbi_token', token);
}

export function clearAuthToken() {
  localStorage.removeItem('orbi_token');
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getAuthToken();
  const headers = new Headers(options.headers || {});
  
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  
  if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });
  } catch (netErr: any) {
    throw new Error(
      `Network connection failed (${netErr.message || 'Failed to fetch'}). Please ensure the backend server is active at http://127.0.0.1:5000.`
    );
  }

  if (!response.ok) {
    if (response.status === 413) {
      throw new Error("The uploaded file exceeds the 100MB limit. Please upload a smaller PDF.");
    }
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Server responded with status ${response.status}`);
  }

  return response.json();
}

// Authentication & Session
export const authApi = {
  getSession: () => request<{ authenticated: boolean; user_id: string; profile: any; preferences: any }>('/auth/session'),
  login: (email: string) => request<{ success: boolean; token: string; user: any; preferences: any }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email }),
  }),
  register: (full_name: string, email: string) => request<{ success: boolean; token: string; user: any }>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ full_name, email }),
  }),
  logout: () => request<{ success: boolean }>('/auth/logout', { method: 'POST' }),
};

// Profile & Onboarding
export const profileApi = {
  getProfile: () => request<{ profile: any; preferences: any; family: any[] }>('/profile'),
  updateProfile: (data: any) => request<{ success: boolean; profile: any }>('/profile', {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  updatePreferences: (data: any) => request<{ success: boolean; preferences: any }>('/profile/preferences', {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  getFamily: () => request<any[]>('/profile/family'),
  addFamilyMember: (data: any) => request<any>('/profile/family', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  updateFamilyMember: (id: string, data: any) => request<any>(`/profile/family/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  deleteFamilyMember: (id: string) => request<{ success: boolean }>(`/profile/family/${id}`, {
    method: 'DELETE',
  }),
  completeOnboarding: (data: { personal: any; family: any[]; preferences: any }) => request<{ success: boolean; profile: any }>('/profile/onboarding', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
};

// Documents & Smart Memory
export const documentApi = {
  list: (search?: string, category?: string) => {
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (category) params.append('category', category);
    return request<any[]>(`/documents?${params.toString()}`);
  },
  get: (id: string) => request<{ document: any; facts: any[] }>(`/documents/${id}`),
  upload: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return request<{ success: boolean; document: any; facts: any[]; extraction_warning?: string }>('/documents', {
      method: 'POST',
      body: formData,
    });
  },
  delete: (id: string) => request<{ success: boolean }>(`/documents/${id}`, { method: 'DELETE' }),
  reprocess: (id: string) => request<{ success: boolean; document: any; facts: any[]; extraction_warning?: string }>(`/documents/${id}/reprocess`, {
    method: 'POST',
  }),
  updateFact: (factId: string, data: any) => request<any>(`/documents/facts/${factId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
};

// Ask Orbi Assistant
export const assistantApi = {
  ask: (query: string) => request<{ answer: string; source_references: any[] }>('/assistant/ask', {
    method: 'POST',
    body: JSON.stringify({ query }),
  }),
  getHistory: (limit = 30) => request<any[]>(`/assistant/history?limit=${limit}`),
};

// Bills & Payments
export const billApi = {
  list: (status?: string) => {
    const params = status ? `?status=${status}` : '';
    return request<any[]>(`/bills${params}`);
  },
  create: (data: any) => request<any>('/bills', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  update: (id: string, data: any) => request<any>(`/bills/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  updateStatus: (id: string, status: string) => request<{ success: boolean; message: string; bill: any }>(`/bills/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  }),
  delete: (id: string) => request<{ success: boolean }>(`/bills/${id}`, { method: 'DELETE' }),
};

// Application Companion & Multi-Step Task Execution
export const applicationApi = {
  list: (category?: string) => {
    const params = category && category !== 'all' ? `?category=${category}` : '';
    return request<any[]>(`/applications${params}`);
  },
  get: (id: string) => request<any>(`/applications/${id}`),
  propose: (goal: string, institution?: string, doc_id?: string, category?: string) => request<{
    title: string;
    goal: string;
    category: string;
    category_label: string;
    institution: string;
    deadline?: string;
    is_deadline_verified?: boolean;
    deadline_source?: string;
    total_requirements: number;
    matched_count: number;
    verified_requirements_count: number;
    suggested_requirements_count: number;
    missing_documents: string[];
    checklist_proposal: any[];
    clarifying_questions: Array<{ type: string; question: string; urgency: string }>;
    recommendation: string;
    supported_categories: Array<{ key: string; label: string }>;
  }>('/applications/propose', {
    method: 'POST',
    body: JSON.stringify({ goal, institution, doc_id, category }),
  }),
  confirm: (data: any) => request<{ success: boolean; message: string; workflow: any }>('/applications/confirm', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  updateItemStatus: (itemId: string, status: string) => request<{ success: boolean; item: any }>(`/applications/items/${itemId}`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  }),
  delete: (id: string) => request<{ success: boolean }>(`/applications/${id}`, { method: 'DELETE' }),
};

// Calendar, Events & Reminders
export const calendarApi = {
  getEvents: () => request<any[]>('/calendar/events'),
  createEvent: (data: any) => request<any>('/calendar/events', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  deleteEvent: (id: string) => request<{ success: boolean }>(`/calendar/events/${id}`, { method: 'DELETE' }),
  getReminders: (status?: string) => {
    const params = status ? `?status=${status}` : '';
    return request<any[]>(`/calendar/reminders${params}`);
  },
  createReminder: (data: any) => request<any>('/calendar/reminders', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  snoozeReminder: (id: string, minutes = 15) => request<{ success: boolean; reminder: any }>(`/calendar/reminders/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ action: 'snooze', minutes }),
  }),
  dismissReminder: (id: string) => request<{ success: boolean; reminder: any }>(`/calendar/reminders/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ action: 'dismiss' }),
  }),
};

// Daily Briefing & Smart Alerts
export const briefingApi = {
  getToday: () => request<{
    greeting: string;
    date: string;
    summary: string;
    stats: {
      pending_bills: number;
      upcoming_events: number;
      active_reminders: number;
      active_workflows: number;
    };
    alerts: Array<{
      type: string;
      severity: string;
      title: string;
      description: string;
      action_text: string;
      action_url: string;
    }>;
  }>('/briefing/today'),
  getNotifications: () => request<any[]>('/briefing/notifications'),
  markRead: (id: string) => request<{ success: boolean }>(`/briefing/notifications/${id}/read`, { method: 'POST' }),
};
