import { BrowserRouter, Routes, Route } from 'react-router-dom';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<div>Roombook - 회의실 예약 시스템</div>} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
