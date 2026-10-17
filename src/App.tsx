import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { AppLayout } from "@/components/layout/AppLayout";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import Index from "./pages/Index.tsx";
import Auth from "./pages/Auth.tsx";
import TaskFeed from "./pages/TaskFeed.tsx";
import PostTask from "./pages/PostTask.tsx";
import TaskDetail from "./pages/TaskDetail.tsx";
import MyTasks from "./pages/MyTasks.tsx";
import Profile from "./pages/Profile.tsx";
import Notifications from "./pages/Notifications.tsx";
import Admin from "./pages/Admin.tsx";
import VerifyEmail from "./pages/VerifyEmail.tsx";
import ResetPassword from "./pages/ResetPassword.tsx";
import PaymentSuccess from "./pages/PaymentSuccess.tsx";
import PaymentCancelled from "./pages/PaymentCancelled.tsx";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route element={<AppLayout />}>
                {/* Public routes */}
                <Route path="/" element={<Index />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/tasks" element={<TaskFeed />} />
                <Route path="/tasks/:id" element={<TaskDetail />} />
                <Route path="/verify-email" element={<VerifyEmail />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/payment-success" element={<PaymentSuccess />} />
                <Route
                  path="/payment-cancelled"
                  element={<PaymentCancelled />}
                />

                {/* Public profile view */}
                <Route path="/profile/:userId" element={<Profile />} />

                {/* Protected routes */}
                <Route
                  path="/post-task"
                  element={
                    <ProtectedRoute requireEmailVerified>
                      <PostTask />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/my-tasks"
                  element={
                    <ProtectedRoute>
                      <MyTasks />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/profile"
                  element={
                    <ProtectedRoute>
                      <Profile />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/notifications"
                  element={
                    <ProtectedRoute>
                      <Notifications />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin"
                  element={
                    <ProtectedRoute requireAdmin>
                      <Admin />
                    </ProtectedRoute>
                  }
                />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
