-- ====================================================================
-- ORBI — A DIGITAL PA: SUPABASE POSTGRESQL SCHEMA WITH ROW LEVEL SECURITY
-- ====================================================================

-- 1. Profiles Table (extends auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    dob DATE,
    profession TEXT DEFAULT 'Other',
    timezone TEXT DEFAULT 'UTC',
    preferred_language TEXT DEFAULT 'en',
    wedding_anniversary DATE,
    onboarding_completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. User Preferences
CREATE TABLE IF NOT EXISTS public.user_preferences (
    user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    doc_organization BOOLEAN DEFAULT TRUE,
    bill_tracking BOOLEAN DEFAULT TRUE,
    deadline_mgmt BOOLEAN DEFAULT TRUE,
    app_checklists BOOLEAN DEFAULT TRUE,
    calendar_appts BOOLEAN DEFAULT TRUE,
    family_reminders BOOLEAN DEFAULT TRUE,
    daily_briefing BOOLEAN DEFAULT TRUE,
    voice_assistant BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Family Members
CREATE TABLE IF NOT EXISTS public.family_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    relationship TEXT NOT NULL,
    birthday DATE,
    anniversary DATE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Documents & Smart Memory
CREATE TABLE IF NOT EXISTS public.documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    original_name TEXT NOT NULL,
    file_size BIGINT DEFAULT 0,
    mime_type TEXT DEFAULT 'application/pdf',
    storage_path TEXT NOT NULL,
    category TEXT DEFAULT 'general',
    status TEXT DEFAULT 'pending', -- pending, processed, error
    summary TEXT,
    raw_text TEXT,
    extracted_data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Extracted Facts
CREATE TABLE IF NOT EXISTS public.extracted_facts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    document_id UUID REFERENCES public.documents(id) ON DELETE CASCADE,
    fact_type TEXT NOT NULL, -- date, amount, institution, deadline, action, requirement
    label TEXT NOT NULL,
    value TEXT NOT NULL,
    confidence FLOAT DEFAULT 1.0,
    page_number INT DEFAULT 1,
    verified BOOLEAN DEFAULT FALSE,
    source_snippet TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Bills and Payments
CREATE TABLE IF NOT EXISTS public.bills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    biller TEXT NOT NULL,
    amount NUMERIC(12, 2) NOT NULL,
    currency TEXT DEFAULT 'USD',
    due_date DATE NOT NULL,
    status TEXT DEFAULT 'upcoming', -- upcoming, paid, overdue, pending
    advance_reminder_days INT DEFAULT 3,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Events and Appointments
CREATE TABLE IF NOT EXISTS public.events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    event_type TEXT DEFAULT 'appointment', -- appointment, birthday, anniversary, deadline, bill, custom
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ,
    location TEXT,
    recurrence TEXT DEFAULT 'none', -- none, daily, weekly, monthly, yearly
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Persistent Reminders
CREATE TABLE IF NOT EXISTS public.reminders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    due_time TIMESTAMPTZ NOT NULL,
    reminder_type TEXT DEFAULT 'one_time', -- one_time, recurring
    status TEXT DEFAULT 'scheduled', -- scheduled, sent, dismissed, snoozed
    advance_minutes INT DEFAULT 60,
    target_id UUID,
    target_type TEXT, -- bill, task, event, application
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Application Workflows
CREATE TABLE IF NOT EXISTS public.application_workflows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    goal TEXT NOT NULL,
    institution TEXT,
    deadline DATE,
    status TEXT DEFAULT 'in_progress', -- draft, in_progress, completed, archived
    progress INT DEFAULT 0,
    total_steps INT DEFAULT 0,
    completed_steps INT DEFAULT 0,
    requirements_json JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Checklist Items
CREATE TABLE IF NOT EXISTS public.checklist_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id UUID NOT NULL REFERENCES public.application_workflows(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    order_index INT DEFAULT 0,
    status TEXT DEFAULT 'pending', -- pending, in_progress, completed, skipped
    required_document TEXT,
    matched_document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
    deadline DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. Conversation History (Ask Orbi)
CREATE TABLE IF NOT EXISTS public.conversation_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role TEXT NOT NULL, -- user, assistant, system
    content TEXT NOT NULL,
    source_references JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. Smart Notifications / Alerts
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    alert_type TEXT DEFAULT 'info', -- missing_doc, conflict, approaching_deadline, overdue, bill_date
    read BOOLEAN DEFAULT FALSE,
    action_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- INDEXES FOR PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_documents_user ON public.documents(user_id);
CREATE INDEX IF NOT EXISTS idx_extracted_facts_doc ON public.extracted_facts(document_id);
CREATE INDEX IF NOT EXISTS idx_bills_user_due ON public.bills(user_id, due_date);
CREATE INDEX IF NOT EXISTS idx_events_user_start ON public.events(user_id, start_time);
CREATE INDEX IF NOT EXISTS idx_reminders_status_time ON public.reminders(status, due_time);
CREATE INDEX IF NOT EXISTS idx_checklist_workflow ON public.checklist_items(workflow_id);

-- ENABLE ROW LEVEL SECURITY (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.extracted_facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.application_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- POLICIES (Users can only access their own records)
CREATE POLICY "Users access own profile" ON public.profiles FOR ALL USING (auth.uid() = id);
CREATE POLICY "Users access own preferences" ON public.user_preferences FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users access own family members" ON public.family_members FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users access own documents" ON public.documents FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users access own extracted facts" ON public.extracted_facts FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users access own bills" ON public.bills FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users access own events" ON public.events FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users access own reminders" ON public.reminders FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users access own workflows" ON public.application_workflows FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users access own checklist items" ON public.checklist_items FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users access own conversation" ON public.conversation_messages FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users access own notifications" ON public.notifications FOR ALL USING (auth.uid() = user_id);
