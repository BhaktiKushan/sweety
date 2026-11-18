import React, { createContext, useContext, useEffect, useState } from 'react';
import { api } from './api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('sweety_token'));
  const [loading, setLoading] = useState(!!localStorage.getItem('sweety_token'));

  useEffect(() => {
    if (!token) return;
    api('/auth/me', { token })
      .then((data) => setUser(data.user))
      .catch(() => {
        localStorage.removeItem('sweety_token');
        setToken(null);
      })
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function saveSession(newToken, newUser) {
    localStorage.setItem('sweety_token', newToken);
    setToken(newToken);
    setUser(newUser);
  }

  async function login(email, password) {
    const data = await api('/auth/login', { method: 'POST', body: { email, password } });
    saveSession(data.token, data.user);
  }

  async function register(name, email, password) {
    const data = await api('/auth/register', { method: 'POST', body: { name, email, password } });
    saveSession(data.token, data.user);
  }

  function logout() {
    localStorage.removeItem('sweety_token');
    setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
