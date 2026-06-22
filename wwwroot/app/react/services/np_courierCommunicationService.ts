import api from './np_api';

// Courier modal §13 — staff-logged courier communications, backed by the legacy
// tucEvent log (Group 'CE'). GET/POST /api/v1/np/couriers/{id}/communications.

export interface CourierEventTypeOption {
  id: number;
  name: string;
}

export interface CourierCommunication {
  id: number;
  typeId: number;
  typeName: string;
  body: string;
  date: string | null;
  staff: string;
}

export interface CourierCommunications {
  types: CourierEventTypeOption[];
  entries: CourierCommunication[];
}

export const courierCommunicationService = {
  get: (courierId: number) =>
    api.get<CourierCommunications>(`/couriers/${courierId}/communications`).then(r => r.data),

  log: (courierId: number, typeId: number, body: string) =>
    api.post<CourierCommunications>(`/couriers/${courierId}/communications`, { typeId, body }).then(r => r.data),
};
