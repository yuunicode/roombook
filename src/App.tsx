import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import {
  MyMeetingsPage,
  TimetablePage,
  LoginPage,
  ChangePasswordPage,
  DashboardPage,
  MinutesPage,
  MinutesWikiPage,
  AdminPage,
  ReservationPreviewPage,
} from './pages';
import { useVersionRefresh } from './hooks/useVersionRefresh';
import MainLayout from './layouts/MainLayout';
import { useAppState } from './stores';

function AuthLoadingScreen() {
  return (
    <main className="auth-page-wrapper">
      <div className="auth-content-box" style={{ textAlign: 'center' }}>
        <p className="auth-secondary-action">세션 확인 중...</p>
      </div>
    </main>
  );
}

function ProtectedRoute() {
  const { isAuthResolved, isLoggedIn } = useAppState();
  const location = useLocation();

  if (!isAuthResolved) {
    return <AuthLoadingScreen />;
  }
  if (!isLoggedIn) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <Outlet />;
}

function PublicOnlyRoute() {
  const { isAuthResolved, isLoggedIn } = useAppState();

  if (!isAuthResolved) {
    return <AuthLoadingScreen />;
  }
  if (isLoggedIn) {
    return <Navigate to="/" replace />;
  }
  return <Outlet />;
}

function App() {
  useVersionRefresh();

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<ProtectedRoute />}>
          <Route element={<MainLayout />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/timetable" element={<TimetablePage />} />
            <Route path="/minutes" element={<MinutesWikiPage />} />
            <Route path="/minutes/:reservationId" element={<MinutesPage />} />
            <Route path="/minutes-wiki" element={<MinutesWikiPage />} />
            <Route path="/my-meetings" element={<MyMeetingsPage />} />
            <Route path="/admin" element={<AdminPage />} />
          </Route>
          <Route path="/change-password" element={<ChangePasswordPage />} />
        </Route>
        <Route element={<PublicOnlyRoute />}>
          <Route path="/login" element={<LoginPage />} />
        </Route>
        <Route path="/preview/reservation-ui" element={<ReservationPreviewPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
