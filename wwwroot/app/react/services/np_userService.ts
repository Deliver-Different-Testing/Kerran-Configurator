import api from './np_api';
import type { User } from '@/types';

// Unified Permissions §8.1 — Contact modal types.
export interface NpUserDetail {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  jobTitle: string;
  mobile: string;
  directDial: string;
  notes: string;
  relationshipTypeId: number | null;
  roleIds: number[];
  status: 'active' | 'inactive';
  clientId: number | null;
  clientName: string;
}

export interface NpRoleOption { id: number; name: string; description: string; }
export interface NpContactAudit { changedAt: string; field: string; oldValue: string; newValue: string; changedBy: string; }
export interface NpRelationshipType { id: number; name: string; }
export interface NpResolvedPerm { key: string; displayName: string; level: number; }
export interface NpResolvedTile { key: string; displayName: string; level: number; items: NpResolvedPerm[]; }

export interface NpUserSavePayload {
  firstName: string;
  lastName: string;
  email: string;
  jobTitle: string;
  mobile: string;
  directDial: string;
  notes: string;
  relationshipTypeId: number | null;
  roleIds: number[];
  status: 'active' | 'inactive';
}

export const userService = {
  async getAll(): Promise<User[]> {
    const { data } = await api.get<User[]>('/users');
    return data ?? [];
  },

  async getDetail(id: number | string): Promise<NpUserDetail> {
    const { data } = await api.get<NpUserDetail>(`/users/${id}`);
    return data;
  },

  async getResolvedPermissions(id: number | string): Promise<NpResolvedTile[]> {
    const { data } = await api.get<NpResolvedTile[]>(`/users/${id}/permissions`);
    return data ?? [];
  },

  async getHistory(id: number | string): Promise<NpContactAudit[]> {
    const { data } = await api.get<NpContactAudit[]>(`/users/${id}/history`);
    return data ?? [];
  },

  async getAssignableRoles(): Promise<NpRoleOption[]> {
    const { data } = await api.get<NpRoleOption[]>('/users/lookups/roles');
    return data ?? [];
  },

  async getRelationshipTypes(): Promise<NpRelationshipType[]> {
    const { data } = await api.get<NpRelationshipType[]>('/users/lookups/relationship-types');
    return data ?? [];
  },

  // Add User — POST creates the tucClientContact + Hub invite cascade.
  async create(payload: {
    firstName: string; lastName: string; email: string;
    roleIds: number[]; relationshipTypeId: number | null; jobTitle: string; mobile: string;
  }): Promise<{ user: NpUserDetail | null; message: string | null }> {
    const { data } = await api.post<{ user: NpUserDetail; messages?: { message: string }[] }>('/users', payload);
    return { user: data?.user ?? null, message: data?.messages?.[0]?.message ?? null };
  },

  async update(id: number | string, payload: NpUserSavePayload): Promise<NpUserDetail | null> {
    const { data } = await api.put<NpUserDetail>(`/users/${id}`, payload);
    return data ?? null;
  },
};
