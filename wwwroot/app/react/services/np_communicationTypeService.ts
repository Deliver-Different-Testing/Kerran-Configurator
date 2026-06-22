import api from './np_api';

// Courier modal §14 — tenant-editable tucEventType catalogue (the 'CE'
// courier-communications group + others). Backs the §13 Type dropdown.
// GET/POST/PUT /api/v1/np/communication-types (TenantStaffOrAdmin).

export interface CommunicationType {
  id: number;
  name: string;
  group: string;
}

export const communicationTypeService = {
  list: (group?: string) =>
    api.get<{ items: CommunicationType[] }>(`/communication-types${group ? `?group=${encodeURIComponent(group)}` : ''}`)
      .then(r => r.data.items),

  create: (name: string, group: string) =>
    api.post<{ item: CommunicationType }>('/communication-types', { name, group }).then(r => r.data.item),

  update: (id: number, name: string, group: string) =>
    api.put<{ item: CommunicationType }>(`/communication-types/${id}`, { name, group }).then(r => r.data.item),
};
