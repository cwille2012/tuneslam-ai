import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import PlayerPage from './pages/PlayerPage';
import './App.css';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/session/:sessionName" element={<PlayerPage />} />
      </Routes>
    </Router>
  );
}

export default App;
