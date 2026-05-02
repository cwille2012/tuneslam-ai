import React, { useState } from 'react';
import { authAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import Header from '../components/Header';

function AccountSettings() {
  const { user, updateUser } = useAuth();
  const [formData, setFormData] = useState({
    username: user?.username || '',
    email: user?.email || '',
    phoneNumber: user?.phoneNumber || '',
    businessName: user?.businessName || '',
    address: user?.address || {
      street: '',
      city: '',
      state: '',
      zipCode: '',
      country: ''
    }
  });
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleProfileChange = (e) => {
    const { name, value } = e.target;
    if (name.startsWith('address.')) {
      const field = name.split('.')[1];
      setFormData(prev => ({
        ...prev,
        address: { ...prev.address, [field]: value }
      }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordData(prev => ({ ...prev, [name]: value }));
  };

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    setError('');
    setLoading(true);

    try {
      const response = await authAPI.updateProfile(formData);
      const { user: updatedUser, token } = response.data;
      
      if (token) {
        localStorage.setItem('token', token);
      }
      
      updateUser(updatedUser);
      setMessage('Profile updated successfully');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    setError('');

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setError('New passwords do not match');
      return;
    }

    if (passwordData.newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);

    try {
      await authAPI.changePassword({
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword
      });
      
      setMessage('Password updated successfully');
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Header />
      
      <div className="container">
        <div className="card">
          <h1>Account Settings</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Manage your account information</p>
        </div>

        <div className="card">
          <h2>Profile Information</h2>
          
          <form onSubmit={handleProfileSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="form-group">
                <label>Username</label>
                <input
                  type="text"
                  name="username"
                  value={formData.username}
                  onChange={handleProfileChange}
                  disabled={loading}
                />
              </div>

              <div className="form-group">
                <label>Business Name</label>
                <input
                  type="text"
                  name="businessName"
                  value={formData.businessName}
                  onChange={handleProfileChange}
                  disabled={loading}
                />
              </div>

              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleProfileChange}
                  disabled={loading}
                />
              </div>

              <div className="form-group">
                <label>Phone Number</label>
                <input
                  type="tel"
                  name="phoneNumber"
                  value={formData.phoneNumber}
                  onChange={handleProfileChange}
                  disabled={loading}
                />
              </div>
            </div>

            <div className="form-group">
              <label>Street Address</label>
              <input
                type="text"
                name="address.street"
                value={formData.address.street}
                onChange={handleProfileChange}
                disabled={loading}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
              <div className="form-group">
                <label>City</label>
                <input
                  type="text"
                  name="address.city"
                  value={formData.address.city}
                  onChange={handleProfileChange}
                  disabled={loading}
                />
              </div>

              <div className="form-group">
                <label>State</label>
                <input
                  type="text"
                  name="address.state"
                  value={formData.address.state}
                  onChange={handleProfileChange}
                  disabled={loading}
                />
              </div>

              <div className="form-group">
                <label>Zip Code</label>
                <input
                  type="text"
                  name="address.zipCode"
                  value={formData.address.zipCode}
                  onChange={handleProfileChange}
                  disabled={loading}
                />
              </div>
            </div>

            {message && <div className="success-message">{message}</div>}
            {error && <div className="error-message">{error}</div>}

            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </form>
        </div>

        <div className="card">
          <h2>Change Password</h2>
          
          <form onSubmit={handlePasswordSubmit}>
            <div className="form-group">
              <label>Current Password</label>
              <input
                type="password"
                name="currentPassword"
                value={passwordData.currentPassword}
                onChange={handlePasswordChange}
                disabled={loading}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="form-group">
                <label>New Password</label>
                <input
                  type="password"
                  name="newPassword"
                  value={passwordData.newPassword}
                  onChange={handlePasswordChange}
                  disabled={loading}
                />
              </div>

              <div className="form-group">
                <label>Confirm New Password</label>
                <input
                  type="password"
                  name="confirmPassword"
                  value={passwordData.confirmPassword}
                  onChange={handlePasswordChange}
                  disabled={loading}
                />
              </div>
            </div>

            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Changing...' : 'Change Password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default AccountSettings;
