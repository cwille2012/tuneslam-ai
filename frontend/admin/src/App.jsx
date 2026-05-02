import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import CreateSession from './pages/CreateSession';
import ManageSession from './pages/ManageSession';
import UserManagement from './pages/UserManagement';
import SessionSettings from './pages/SessionSettings';
import AccountSettings from './pages/AccountSettings';
import './App.css';

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return <div className="loading"><div className="spinner"></div></div>;
  }
  
  return user ? children : <Navigate to="/login" />;
};

function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/dashboard" element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } />
          <Route path="/session/create" element={
            <ProtectedRoute>
              <CreateSession />
            </ProtectedRoute>
          } />
          <Route path="/session/:sessionName" element={
            <ProtectedRoute>
              <ManageSession />
            </ProtectedRoute>
          } />
          <Route path="/session/:sessionName/users" element={
            <ProtectedRoute>
              <UserManagement />
            </ProtectedRoute>
          } />
          <Route path="/session/:sessionName/settings" element={
            <ProtectedRoute>
              <SessionSettings />
            </ProtectedRoute>
          } />
          <Route path="/settings" element={
            <ProtectedRoute>
              <AccountSettings />
            </ProtectedRoute>
          } />
          <Route path="/" element={<Navigate to="/dashboard" />} />
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;
