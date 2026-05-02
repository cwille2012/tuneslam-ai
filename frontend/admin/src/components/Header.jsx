import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="app-header">
      <div className="container">
        <Link to="/dashboard" className="app-logo">
          TuneSlam Admin
        </Link>
        
        <nav className="app-nav">
          <Link to="/dashboard">Dashboard</Link>
          <Link to="/settings">Settings</Link>
          <button onClick={handleLogout} className="btn btn-secondary" style={{ padding: '8px 16px' }}>
            Logout
          </button>
        </nav>
      </div>
    </header>
  );
}

export default Header;
