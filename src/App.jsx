import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
import ProtectedRoute from '@/components/ProtectedRoute';

// Auth pages
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';

// App pages
import AppLayout from '@/components/AppLayout';
import HomePage from '@/pages/HomePage';
import Dashboard from '@/pages/Dashboard';
import Configs from '@/pages/Configs';
import AdminPanel from '@/pages/AdminPanel';

const MotionRoute = ({ element }) => {
  return (
    <motion.div
      initial={{ opacity: 0, filter: 'blur(10px)', scale: 0.98 }}
      animate={{ opacity: 1, filter: 'blur(0px)', scale: 1 }}
      exit={{ opacity: 0, filter: 'blur(10px)', scale: 0.98 }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
    >
      {element}
    </motion.div>
  );
};

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();
  const location = useLocation();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center" style={{ background: "#07070d" }}>
        <div className="w-8 h-8 border-2 border-cyan-400/20 border-t-cyan-400 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    }
  }

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/login" element={<MotionRoute element={<Login />} />} />
        <Route path="/register" element={<MotionRoute element={<Register />} />} />
        <Route path="/forgot-password" element={<MotionRoute element={<ForgotPassword />} />} />
        <Route path="/reset-password" element={<MotionRoute element={<ResetPassword />} />} />

        <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
          <Route element={<AppLayout />}>
            <Route path="/" element={<MotionRoute element={<HomePage />} />} />
            <Route path="/dashboard" element={<MotionRoute element={<Dashboard />} />} />
            <Route path="/configs" element={<MotionRoute element={<Configs />} />} />
            <Route path="/admin" element={<MotionRoute element={<AdminPanel />} />} />
          </Route>
        </Route>

        <Route path="*" element={<MotionRoute element={<PageNotFound />} />} />
      </Routes>
    </AnimatePresence>
  );
};

function App() {
  return (
    <Router>
      <AuthProvider>
        <QueryClientProvider client={queryClientInstance}>
          <ScrollToTop />
          <AuthenticatedApp />
          <Toaster />
        </QueryClientProvider>
      </AuthProvider>
    </Router>
  )
}

export default App
