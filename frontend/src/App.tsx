import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LandingPage } from './pages/LandingPage';
import { OnboardingPage } from './pages/OnboardingPage';
import { DashboardLayout } from './components/layout/DashboardLayout';
import { DashboardPage } from './pages/DashboardPage';
import { DocumentsPage } from './pages/DocumentsPage';
import { ApplicationsPage } from './pages/ApplicationsPage';
import { BillsPage } from './pages/BillsPage';
import { CalendarPage } from './pages/CalendarPage';
import { AssistantPage } from './pages/AssistantPage';
import { SettingsPage } from './pages/SettingsPage';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Landing, Login & Onboarding */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LandingPage initialMode="login" />} />
        <Route path="/signup" element={<LandingPage initialMode="signup" />} />
        <Route path="/onboarding" element={<OnboardingPage />} />

        {/* Authenticated Executive Workspace */}
        <Route element={<DashboardLayout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/documents" element={<DocumentsPage />} />
          <Route path="/applications" element={<ApplicationsPage />} />
          <Route path="/bills" element={<BillsPage />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/assistant" element={<AssistantPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
