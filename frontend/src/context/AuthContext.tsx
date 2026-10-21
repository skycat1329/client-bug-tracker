import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../api/client.js';
import { User } from '../types/index.js';

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password?: string) => Promise<User>;
  register: (data: any) => Promise<void>;
  forceResetPassword: (newPassword: string) => Promise<void>;
  logout: () => void;
  switchDemoUser: (email: string) => Promise<void>;
  demoUsers: (User & { organization_name?: string })[];
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);
  const [demoUsers, setDemoUsers] = useState<any[]>([]);

  useEffect(() => {
    // Listen for global auth:expired event from client interceptor
    const handleAuthExpired = () => {
      localStorage.removeItem('token');
      setToken(null);
      setUser(null);
    };

    window.addEventListener('auth:expired', handleAuthExpired);
    return () => window.removeEventListener('auth:expired', handleAuthExpired);
  }, []);

  useEffect(() => {
    // Load available demo users for quick role testing
    api.get<{ users: any[] }>('/auth/demo-users')
      .then((res) => setDemoUsers(res.users || []))
      .catch((err) => console.warn('Could not load demo users:', err));

    // Restore session if token exists
    if (token) {
      api.get<{ user: User }>('/auth/me')
        .then((res) => setUser(res.user))
        .catch(() => {
          localStorage.removeItem('token');
          setToken(null);
          setUser(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [token]);

  const login = async (email: string, password = 'password123'): Promise<User> => {
    setLoading(true);
    try {
      const res = await api.post<{ token: string; user: User }>('/auth/login', {
        email,
        password,
      });
      localStorage.setItem('token', res.token);
      setToken(res.token);
      setUser(res.user);
      return res.user;
    } finally {
      setLoading(false);
    }
  };

  const forceResetPassword = async (newPassword: string) => {
    setLoading(true);
    try {
      const res = await api.post<{ token: string; user: User; message: string }>('/auth/force-reset-password', {
        new_password: newPassword,
      });
      if (res.token) {
        localStorage.setItem('token', res.token);
        setToken(res.token);
      }
      setUser(res.user);
    } finally {
      setLoading(false);
    }
  };

  const register = async (data: any) => {
    setLoading(true);
    try {
      const res = await api.post<{ token: string; user: User }>('/auth/register', data);
      localStorage.setItem('token', res.token);
      setToken(res.token);
      setUser(res.user);
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };

  const switchDemoUser = async (email: string) => {
    let pwd = 'password123';
    if (email === 'admin@agency.com') pwd = 'admin123';
    if (email === 'dev@agency.com') pwd = 'dev123';
    await login(email, pwd);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        register,
        forceResetPassword,
        logout,
        switchDemoUser,
        demoUsers,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
