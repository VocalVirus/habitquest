import { createContext, useContext, useState } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('habitquest_user');
    return stored ? JSON.parse(stored) : null;
  });

  const [token, setToken] = useState(() => localStorage.getItem('habitquest_token'));

  function saveSession(userData, jwt) {
    setUser(userData);
    setToken(jwt);
    localStorage.setItem('habitquest_user', JSON.stringify(userData));
    localStorage.setItem('habitquest_token', jwt);
    axios.defaults.headers.common['Authorization'] = `Bearer ${jwt}`;
  }

  async function login(email, password) {
    const { data } = await axios.post(`${API}/auth/login`, { email, password });
    saveSession(data.user, data.token);
  }

  async function register(username, email, password) {
    const { data } = await axios.post(`${API}/auth/register`, { username, email, password });
    saveSession(data.user, data.token);
  }

  function logout() {
    setUser(null);
    setToken(null);
    localStorage.removeItem('habitquest_user');
    localStorage.removeItem('habitquest_token');
    delete axios.defaults.headers.common['Authorization'];
  }

  return (
    <AuthContext.Provider value={{ user, token, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
