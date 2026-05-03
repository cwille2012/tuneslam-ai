import React, { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../services/api';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('tuneslam_user_token');
      const storedUser = localStorage.getItem('tuneslam_user_data');
      
      if (token && storedUser) {
        try {
          const response = await authAPI.getMe();
          setUser(response.data.user);
        } catch (error) {
          localStorage.removeItem('tuneslam_user_token');
          localStorage.removeItem('tuneslam_user_data');
        }
      }
      setLoading(false);
    };

    initAuth();
  }, []);

  const login = async (identifier, password) => {
    const response = await authAPI.login({ identifier, password });
    const { user, token } = response.data;
    
    localStorage.setItem('tuneslam_user_token', token);
    localStorage.setItem('tuneslam_user_data', JSON.stringify(user));
    setUser(user);
    
    return user;
  };

  const register = async (userData) => {
    const response = await authAPI.register(userData);
    const { user, token } = response.data;
    
    localStorage.setItem('tuneslam_user_token', token);
    localStorage.setItem('tuneslam_user_data', JSON.stringify(user));
    setUser(user);
    
    return user;
  };

  const logout = () => {
    localStorage.removeItem('tuneslam_user_token');
    localStorage.removeItem('tuneslam_user_data');
    setUser(null);
  };

  const updateUser = (newUserData) => {
    setUser(newUserData);
    localStorage.setItem('tuneslam_user_data', JSON.stringify(newUserData));
  };

  const setAuthData = (userData, token) => {
    localStorage.setItem('tuneslam_user_token', token);
    localStorage.setItem('tuneslam_user_data', JSON.stringify(userData));
    setUser(userData);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, updateUser, setAuthData }}>
      {children}
    </AuthContext.Provider>
  );
};
