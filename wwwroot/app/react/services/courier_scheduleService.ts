import courierApi from './courier_api';

// Phase 2 — courier availability client (mirrors Core/Application/Dtos/Courier).
// StatusId: 1 = Available, 2 = Unavailable.

export interface CourierTimeSlot {
  id: number;
  bookDateTime: string;
  wanted: number | null;
  remaining: number | null;
}

export interface CourierScheduleResponseState {
  statusId: number;
  timeSlotId: number | null;
}

export interface CourierScheduleItem {
  id: number;
  bookDate: string;
  name: string;
  startTime: string;
  endTime: string;
  wanted: number;
  hasTimeSlots: boolean;
  timeSlots: CourierTimeSlot[];
  response: CourierScheduleResponseState | null;
}

export const courierScheduleService = {
  list: () => courierApi.get<CourierScheduleItem[]>('/schedule').then(r => r.data),
  available: (id: number, timeSlotId?: number | null) =>
    courierApi.put<CourierScheduleItem[]>(`/schedule/${id}/available`, { timeSlotId: timeSlotId ?? null }).then(r => r.data),
  unavailable: (id: number) =>
    courierApi.put<CourierScheduleItem[]>(`/schedule/${id}/unavailable`, {}).then(r => r.data),
};
