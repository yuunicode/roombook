import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { HomePage, MyMeetingsPage } from './pages';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/my-meetings" element={<MyMeetingsPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
