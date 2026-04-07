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
        <Route element={<MainLayout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/timetable" element={<TimetablePage />} />
          <Route path="/minutes" element={<MinutesPage />} />
          <Route path="/my-meetings" element={<MyMeetingsPage />} />
          <Route path="/admin/users" element={<AdminUsersPage />} />
        </Route>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/change-password" element={<ChangePasswordPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
