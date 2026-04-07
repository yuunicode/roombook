import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { 
  AdminUsersPage, 
  MyMeetingsPage, 
  TimetablePage, 
  LoginPage, 
  ChangePasswordPage,
  DashboardPage,
  MinutesPage
} from './pages';
import MainLayout from './layouts/MainLayout';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* 공통 레이아웃이 적용되는 라우트 */}
        <Route element={<MainLayout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/timetable" element={<TimetablePage />} />
          <Route path="/minutes" element={<MinutesPage />} />
          <Route path="/my-meetings" element={<MyMeetingsPage />} />
          <Route path="/admin/users" element={<AdminUsersPage />} />
        </Route>

        {/* 독립적인 페이지 (배경 및 레이아웃이 다름) */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/change-password" element={<ChangePasswordPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
