# Orbi — A Digital PA
> **One assistant. Everything organized.**
> *"Your life, organized. Your time, yours."*

Orbi is a private, AI-powered personal digital executive assistant designed to organize documents, bills, deadlines, multi-step applications, family milestones, and persistent reminders. Grounded exclusively in authentic user records, Orbi eliminates mental clutter without hallucinating data or claiming false actions.

---

## 🌟 Key Features

1. **Smart Memory & PDF Extraction**
   - Direct PDF parsing with **PyMuPDF** (`fitz`).
   - Automated categorization (`bill`, `application`, `medical`, `government`, `legal`, `general`).
   - Heuristic and structured fact extraction (due dates, amounts, billing institutions, deadlines, actions).
   - In-place user verification and manual fact correction.
   - Transparent reporting of scanned/OCR limitations without fabrication.

2. **Application Companion & Multi-Step Task Execution *(Orbi's Signature Feature)***
   - Turns complicated goals (visas, university admissions, mortgages, licenses) into structured workflows.
   - Cross-references requirements against documents present in Smart Memory.
   - Highlights missing documents and generates an ordered checklist.
   - User maintains 100% control over confirmation, submissions, and signatures.

3. **Proactive Bill Tracking & Payments**
   - Extracts billing amounts and due dates from PDF utility invoices.
   - Automatic advance reminders scheduled 1, 3, or 7 days ahead.
   - Upcoming and overdue dashboard monitoring.
   - Safe manual payment status tracking (clearly stating no external banking transaction occurred).

4. **Calendar, Family Milestones & Persistent Reminders**
   - Unified agenda of appointments, family birthdays, wedding anniversaries, and deadlines.
   - Persistent backend scheduler worker powered by **APScheduler** (runs independently of browser state).
   - Snooze (15m, 1h), Dismiss, and Complete controls.

5. **Conversational "Ask Orbi" & Voice Assistant**
   - Conversational assistant answering queries grounded exclusively in user records.
   - Source citations with clickable reference badges.
   - Integrated **Web Speech API** for voice dictation and speech synthesis readout.

6. **Professional Glassmorphism Design System**
   - Deep midnight navy (`#070B14`, `#0D1527`), slate blue, muted steel blue, subtle periwinkle, and warm ivory accents.
   - Frosted glass surfaces with backdrop blur, controlled highlights, and accessible contrast.
   - Reusable component library: `GlassCard`, `GlassPanel`, `GlassButton`, `GlassInput`, `GlassModal`, `AppSidebar`, `LoadingState`, `EmptyState`, and `ErrorState`.

7. **Security & Privacy Architecture**
   - PostgreSQL schema with **Supabase Row Level Security (RLS)** policies.
   - Local dual-storage engine with SQLite WAL mode.
   - Zero third-party data monetization or training on private documents.

---

## 🛠️ Technology Stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS v4 (`@tailwindcss/vite`), React Router v7, Lucide React.
- **Backend**: Python 3.13, Flask 3.1, Flask-CORS.
- **Document Extraction**: PyMuPDF (`fitz`).
- **Persistent Scheduler**: APScheduler (Background thread checking due reminders every 60s).
- **Database & Auth**: Dual-mode engine:
  - Supabase PostgreSQL with complete RLS migration (`backend/supabase_schema.sql`).
  - Self-initializing local SQLite engine (`backend/orbi.db`) with Write-Ahead Logging (WAL) and foreign keys.
- **AI Engine**: Google Gemini API integration with context grounding and fallback heuristic reasoning.

---

## 🚀 Getting Started

### 1. Prerequisites
- **Node.js** >= 18 (Tested on v24.14.0)
- **Python** >= 3.10 (Tested on Python 3.13)
- **npm** >= 9

### 2. Backend Setup
1. Open a terminal in the project directory:
   ```bash
   cd backend
   ```
2. Install Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. (Optional) Configure environment variables in `backend/.env`:
   ```env
   FLASK_ENV=development
   SECRET_KEY=your-secure-secret-key
   GEMINI_API_KEY=your-gemini-key   # Optional for Gemini AI model
   SUPABASE_URL=                   # Optional for Supabase sync
   SUPABASE_KEY=                   # Optional for Supabase sync
   ```
4. Start the backend server:
   ```bash
   python app.py
   ```
   *The Flask API will start on `http://127.0.0.1:5000` with the persistent reminder scheduler active.*

### 3. Frontend Setup
1. In a separate terminal, navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install npm packages:
   ```bash
   npm install
   ```
3. Start the Vite development server:
   ```bash
   npm run dev
   ```
   *The web application will open at `http://localhost:5173` (proxied to `/api`).*

4. Build for production:
   ```bash
   npm run build
   ```

---

## 🗄️ Database & Supabase Migrations

The complete PostgreSQL schema with Row Level Security is available in:
[`backend/supabase_schema.sql`](file:///c:/Users/sonik/Desktop/hack/backend/supabase_schema.sql)

### Supabase Deployment Steps:
1. Log into your [Supabase Dashboard](https://supabase.com).
2. Open the **SQL Editor** tab.
3. Paste the contents of `backend/supabase_schema.sql` and run the script.
4. Copy your Supabase Project URL and Anon Key into `backend/.env`.

---

## 🧪 Testing & Verification

Orbi includes an automated test suite verifying all 12 stages of the complete user journey:

### 1. Run the Full 12-Step Journey Test:
```bash
python test_full_journey.py
```
**Journey Verified:**
1. User registration & 4-step onboarding.
2. Personalized dashboard generation with daily briefing.
3. PDF upload and extraction (`sample_electric_bill.pdf`).
4. Verification of extracted amount ($154.80) and due date.
5. "Ask Orbi" conversational query answering with source references.
6. PDF application notice parsing (`sample_visa_application_notice.pdf`).
7. Application Companion checklist proposal & user confirmation.
8. Adding family members & birthdays.
9. Persistent reminder scheduling.
10. Dashboard live metric updates.
11. Persistence verification across app restarts.
12. Validation tests (non-PDF rejection, empty query rejection, authorization enforcement).

### 2. Run Backend Unit Tests:
```bash
python backend/test_backend.py
```

### 3. Generate Sample PDF Test Files:
```bash
python generate_sample_pdfs.py
```

---

## 🛡️ Limitations & Transparency

- **Scanned Images**: PyMuPDF extracts embedded text layers from native PDFs. If a user uploads an image-only scanned document without an embedded text layer, Orbi clearly notifies the user of the OCR limitation rather than hallucinating text.
- **Financial Actions**: Orbi allows users to mark bills as paid for organizational recordkeeping. It will never claim an external banking transaction or wire transfer occurred without an explicit third-party banking integration.
- **Application Filings**: The Application Companion guides users through requirements, deadlines, and checklists. The user maintains final control over all submissions, signatures, and personal disclosures.
