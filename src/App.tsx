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

// Admin Pages
import AdminDashboard from "@/pages/admin/AdminDashboard";
import ClientsList from "@/pages/admin/ClientsList";
import ClientDetail from "@/pages/admin/ClientDetail";
import ViewAsClient from "@/pages/admin/ViewAsClient";
import AdminSettings from "@/pages/admin/AdminSettings";

// Client Pages
import ClientDashboard from "@/pages/dashboard/ClientDashboard";
import CallLogs from "@/pages/dashboard/CallLogs";
import Automations from "@/pages/dashboard/Automations";
import Team from "@/pages/dashboard/Team";
import ClientSettings from "@/pages/dashboard/ClientSettings";

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
            <Route path="/privacy" element={<PrivacyPolicy />} />
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
              <Route path="/dashboard/team" element={<Team />} />
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
