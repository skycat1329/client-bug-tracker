import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../api/client.js';
import { User } from '../types/index.js';

export interface LoginResult {
  user?: User;
  require_2fa?: boolean;
  setup_2fa?: boolean;
  temp_token?: string;
  totp_secret?: string;
  totp_uri?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password?: string, portal?: 'brand' | 'admin', totpCode?: string) => Promise<LoginResult>;
  verify2FA: (tempToken: string, totpCode: string) => Promise<User>;
  setup2FA: (tempToken: string, totpCode: string) => Promise<User>;
  register: (data: any) => Promise<void>;
  forceResetPassword: (newPassword: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

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
    // Restore session if token exists
    if (token) {
      api.get<{ user: User }>('/auth/me')
        .then((res) => {
          setUser(res.user);
        })
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

  const login = async (
    email: string,
    password = '',
    portal?: 'brand' | 'admin',
    totpCode?: string
  ): Promise<LoginResult> => {
    setLoading(true);
    try {
      const res = await api.post<{
        token?: string;
        user?: User;
        require_2fa?: boolean;
        setup_2fa?: boolean;
        temp_token?: string;
        totp_secret?: string;
        totp_uri?: string;
      }>('/auth/login', {
        email,
        password,
        portal,
        totp_code: totpCode,
      });

      if (res.require_2fa || res.setup_2fa) {
        return res;
      }

      if (res.token && res.user) {
        localStorage.setItem('token', res.token);
        setToken(res.token);
        setUser(res.user);
      }
      return res;
    } finally {
      setLoading(false);
    }
  };

  const verify2FA = async (tempToken: string, totpCode: string): Promise<User> => {
    setLoading(true);
    try {
      const res = await api.post<{ token: string; user: User }>('/auth/2fa/verify', {
        temp_token: tempToken,
        totp_code: totpCode,
      });
      localStorage.setItem('token', res.token);
      setToken(res.token);
      setUser(res.user);
      return res.user;
    } finally {
      setLoading(false);
    }
  };

  const setup2FA = async (tempToken: string, totpCode: string): Promise<User> => {
    setLoading(true);
    try {
      const res = await api.post<{ token: string; user: User }>('/auth/2fa/setup', {
        temp_token: tempToken,
        totp_code: totpCode,
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

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        verify2FA,
        setup2FA,
        register,
        forceResetPassword,
        logout,
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
