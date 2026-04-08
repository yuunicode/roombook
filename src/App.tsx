import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { 
  MyMeetingsPage, 
  TimetablePage, 
  LoginPage, 
  ChangePasswordPage,
  DashboardPage,
  MinutesPage,
  MinutesWikiPage
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
          <Route path="/minutes/:reservationId" element={<MinutesPage />} />
          <Route path="/minutes-wiki" element={<MinutesWikiPage />} />
          <Route path="/my-meetings" element={<MyMeetingsPage />} />
        </Route>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/change-password" element={<ChangePasswordPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
