import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import TVDisplay from './pages/TVDisplay';
import './App.css';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/viewer/:sessionName" element={<TVDisplay />} />
      </Routes>
    </Router>
  );
}

export default App;
