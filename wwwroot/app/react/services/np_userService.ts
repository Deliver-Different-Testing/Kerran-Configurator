import api from './np_api';
import type { User } from '@/types';

export const userService = {
  async getAll(): Promise<User[]> {
    const { data } = await api.get<User[]>('/users');
    return data ?? [];
  },

  async getById(id: string): Promise<User | undefined> {
    const all = await this.getAll();
    return all.find(u => u.id === id);
  },

  async getRoles(): Promise<string[]> {
    return ['Admin', 'Dispatcher', 'Read-Only'];
  },

  // Phase 5+28b §B.2 — Add User from the NP team page. POST creates the
  // tucClientContact server-side + dispatches the Hub invite cascade
  // (see NpUserService.CreateAsync). Backend returns a wrapped response
  // so we can surface the partial-failure warning message in the UI.
  async create(payload: { name: string; email: string; role: string }): Promise<{ user: User; message: string | null }> {
    const { data } = await api.post<{ user: User; messages?: { message: string }[] }>('/users', {
      name: payload.name,
      email: payload.email,
      role: payload.role,
    });
    return {
      user: data?.user as User,
      message: data?.messages?.[0]?.message ?? null,
    };
  },

  async update(id: string, updates: Partial<User>): Promise<User> {
    const payload = {
      name: updates.name ?? '',
      email: updates.email ?? '',
      role: updates.role ?? 'Dispatcher',
      status: updates.status ?? 'active',
    };
    const { data } = await api.put<User>(`/users/${id}`, payload);
    if (!data) throw new Error('Server returned no user');
    return data;
  },

  async remove(_id: string): Promise<boolean> {
    return false;
  },
};
