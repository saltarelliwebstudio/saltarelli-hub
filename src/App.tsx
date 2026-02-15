import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import DashboardLayout from "@/components/layout/DashboardLayout";

// Pages
import Login from "@/pages/Login";
import PrivacyPolicy from "@/pages/PrivacyPolicy";
import NotFound from "@/pages/NotFound";
import ResetPassword from "@/pages/ResetPassword";

// Admin Pages
import AdminDashboard from "@/pages/admin/AdminDashboard";
import ClientsList from "@/pages/admin/ClientsList";
import ClientDetail from "@/pages/admin/ClientDetail";
import ViewAsClient from "@/pages/admin/ViewAsClient";
import AdminAnalytics from "@/pages/admin/AdminAnalytics";
import IntegrationSettings from "@/pages/admin/IntegrationSettings";
import AdminSettings from "@/pages/admin/AdminSettings";
import AdminMessages from "@/pages/admin/AdminMessages";

// Client Pages
import ClientDashboard from "@/pages/dashboard/ClientDashboard";
import CallLogs from "@/pages/dashboard/CallLogs";
import Automations from "@/pages/dashboard/Automations";
import Leads from "@/pages/dashboard/Leads";
import Support from "@/pages/dashboard/Support";
import Billing from "@/pages/dashboard/Billing";
import ClientSettings from "@/pages/dashboard/ClientSettings";
import Analytics from "@/pages/dashboard/Analytics";
import Website from "@/pages/dashboard/Website";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/privacy-policy" element={<PrivacyPolicy />} />
            <Route path="/privacy" element={<Navigate to="/privacy-policy" replace />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/" element={<Navigate to="/login" replace />} />

            {/* Admin routes */}
            <Route
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <DashboardLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/admin/clients" element={<ClientsList />} />
              <Route path="/admin/clients/:podId" element={<ClientDetail />} />
              <Route path="/admin/messages" element={<AdminMessages />} />
              <Route path="/admin/analytics" element={<AdminAnalytics />} />
              <Route path="/admin/integrations" element={<IntegrationSettings />} />
              <Route path="/admin/settings" element={<AdminSettings />} />
            </Route>

            {/* View as Client route - special layout with banner */}
            <Route
              path="/admin/clients/:podId/view-as-client"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <ViewAsClient />
                </ProtectedRoute>
              }
            >
              <Route index element={<ClientDashboard />} />
              <Route path="calls" element={<CallLogs />} />
              <Route path="automations" element={<Automations />} />
              <Route path="leads" element={<Leads />} />
              <Route path="settings" element={<ClientSettings />} />
            </Route>

            {/* Client routes */}
            <Route
              element={
                <ProtectedRoute allowedRoles={['client', 'member']}>
                  <DashboardLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/dashboard" element={<ClientDashboard />} />
              <Route path="/dashboard/calls" element={<CallLogs />} />
              <Route path="/dashboard/automations" element={<Automations />} />
              <Route path="/dashboard/support" element={<Support />} />
              <Route path="/dashboard/website" element={<Website />} />
              <Route path="/dashboard/analytics" element={<Analytics />} />
              <Route path="/dashboard/billing" element={<Billing />} />
              <Route path="/dashboard/settings" element={<ClientSettings />} />
            </Route>

            {/* Catch-all */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
