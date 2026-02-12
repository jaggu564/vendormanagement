import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '../api/client';

interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  tenant_id: string;
  tenant_name: string;
}

export const useAuth = () => {
  const queryClient = useQueryClient();

  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem('token')
  );

  const [user, setUser] = useState<User | null>(() => {
    const stored = localStorage.getItem('user');
    return stored ? JSON.parse(stored) : null;
  });

  const { isLoading } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: async () => {
      const response = await apiClient.get('/auth/me');
      return response.data.user as User;
    },
    enabled: !!token,
    retry: false,
    onSuccess: (data) => {
      setUser(data);
      localStorage.setItem('user', JSON.stringify(data));
    },
    onError: () => {
      setUser(null);
      setToken(null);
      localStorage.removeItem('user');
      localStorage.removeItem('token');
      localStorage.removeItem('tenant_id');
    },
  });

  const login = async (email: string, password: string, tenantId?: string) => {
    const response = await apiClient.post('/auth/login', {
      email,
      password,
      tenant_id: tenantId,
    });

    const { token, user: userData } = response.data;

    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    localStorage.setItem('tenant_id', userData.tenant_id);

    setToken(token);
    setUser(userData);

    return userData;
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('tenant_id');

    setToken(null);
    setUser(null);

    queryClient.clear();
  };

  return {
    user,
    loading: isLoading,
    login,
    logout,
  };
};
