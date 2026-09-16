import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './components/common/Toast';
import { Header } from './components/layout/Header';
import { Sidebar } from './components/layout/Sidebar';
import { ProtectedRoute } from './components/common/ProtectedRoute';
import { Login } from './pages/Login';
import { ForgotPassword } from './pages/ForgotPassword';
import { ResetPassword } from './pages/ResetPassword';
import { Dashboard } from './pages/Dashboard';
import { Guru } from './pages/Guru';
import { Instrumen } from './pages/Instrumen';
import { TelaahRppm } from './pages/TelaahRppm';
import { Supervisi } from './pages/Supervisi';
import { Laporan } from './pages/Laporan';
import { NilaiGuru } from './pages/NilaiGuru';
import { TindakLanjut } from './pages/TindakLanjut';
import { Pengaturan } from './pages/Pengaturan';

function MainApp() {
  const { isAuthenticated, role, loading } = useAuth();
  const [currentPath, setCurrentPath] = useState<string>(window.location.pathname || '/dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname || '/dashboard');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigateTo = (path: string) => {
    setCurrentPath(path);
    window.history.pushState({}, '', path);
  };

  // Auth pages (Public)
  if (currentPath === '/login') {
    if (isAuthenticated) {
      const targetRoleDashboard =
        role === 'ADMIN'
          ? '/admin/dashboard'
          : role === 'SUPERVISOR'
          ? '/supervisor/dashboard'
          : '/guru/dashboard';
      navigateTo(targetRoleDashboard);
      return null;
    }
    return <Login onNavigate={navigateTo} />;
  }

  if (currentPath === '/forgot-password') {
    return <ForgotPassword onNavigate={navigateTo} />;
  }

  if (currentPath === '/reset-password') {
    return <ResetPassword onNavigate={navigateTo} />;
  }

  // Loading state while checking auth session
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-6">
        <div className="w-10 h-10 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-xs font-semibold text-slate-600">Memuat Sesi Platform SPM-AI...</p>
      </div>
    );
  }

  // If not authenticated, redirect to /login
  if (!isAuthenticated) {
    return <Login onNavigate={navigateTo} />;
  }

  // Render role dashboard or module pages protected by AuthGuard
  const renderContent = () => {
    switch (currentPath) {
      case '/admin/dashboard':
        return (
          <ProtectedRoute allowedRoles={['ADMIN']} onNavigate={navigateTo}>
            <Dashboard onNavigate={navigateTo} />
          </ProtectedRoute>
        );

      case '/supervisor/dashboard':
        return (
          <ProtectedRoute allowedRoles={['SUPERVISOR']} onNavigate={navigateTo}>
            <Dashboard onNavigate={navigateTo} />
          </ProtectedRoute>
        );

      case '/guru/dashboard':
        return (
          <ProtectedRoute allowedRoles={['GURU']} onNavigate={navigateTo}>
            <Dashboard onNavigate={navigateTo} />
          </ProtectedRoute>
        );

      case '/dashboard': {
        const target =
          role === 'ADMIN'
            ? '/admin/dashboard'
            : role === 'SUPERVISOR'
            ? '/supervisor/dashboard'
            : '/guru/dashboard';
        return (
          <ProtectedRoute allowedRoles={['ADMIN', 'SUPERVISOR', 'GURU']} onNavigate={navigateTo}>
            <Dashboard onNavigate={navigateTo} />
          </ProtectedRoute>
        );
      }

      case '/guru':
        return (
          <ProtectedRoute allowedRoles={['ADMIN', 'SUPERVISOR']} onNavigate={navigateTo}>
            <Guru />
          </ProtectedRoute>
        );

      case '/instrumen':
        return (
          <ProtectedRoute allowedRoles={['ADMIN']} onNavigate={navigateTo}>
            <Instrumen />
          </ProtectedRoute>
        );

      case '/telaah':
      case '/telaah-rppm':
        return (
          <ProtectedRoute allowedRoles={['ADMIN', 'SUPERVISOR', 'GURU']} onNavigate={navigateTo}>
            <TelaahRppm />
          </ProtectedRoute>
        );

      case '/supervisi':
        return (
          <ProtectedRoute allowedRoles={['ADMIN', 'SUPERVISOR', 'GURU']} onNavigate={navigateTo}>
            <Supervisi />
          </ProtectedRoute>
        );

      case '/nilai-guru':
        return (
          <ProtectedRoute allowedRoles={['ADMIN', 'SUPERVISOR', 'GURU']} onNavigate={navigateTo}>
            <NilaiGuru />
          </ProtectedRoute>
        );

      case '/laporan':
        return (
          <ProtectedRoute allowedRoles={['ADMIN', 'SUPERVISOR']} onNavigate={navigateTo}>
            <Laporan />
          </ProtectedRoute>
        );

      case '/tindak-lanjut':
        return (
          <ProtectedRoute allowedRoles={['ADMIN', 'SUPERVISOR', 'GURU']} onNavigate={navigateTo}>
            <TindakLanjut />
          </ProtectedRoute>
        );

      case '/pengaturan':
        return (
          <ProtectedRoute allowedRoles={['ADMIN']} onNavigate={navigateTo}>
            <Pengaturan />
          </ProtectedRoute>
        );

      default:
        return (
          <ProtectedRoute allowedRoles={['ADMIN', 'SUPERVISOR', 'GURU']} onNavigate={navigateTo}>
            <Dashboard onNavigate={navigateTo} />
          </ProtectedRoute>
        );
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans antialiased text-slate-800">
      <Header onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />

      <div className="flex-1 flex overflow-hidden">
        <Sidebar
          currentPath={currentPath}
          onNavigate={navigateTo}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        <main className="flex-1 p-4 md:p-8 overflow-y-auto max-w-7xl mx-auto w-full">
          {renderContent()}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <MainApp />
      </ToastProvider>
    </AuthProvider>
  );
}
