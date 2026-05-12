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

  async create(_user: Partial<User>): Promise<User> {
    throw new Error('create() not yet wired to backend');
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
