// Mock data for Scheduling Admin Tools
// Mirrors the data structures from CourierManager ScheduleService

export interface VehicleSummary {
  vehicle: string;
  available: number;
  total: number;
}

export interface ScheduleSummary {
  id: number;
  created: string;
  bookDate: string;
  location: string;
  name: string;
  notificationSent: string | null;
  startTime: string; // "HH:mm:ss"
  endTime: string;
  wanted: number;
  available: number;
  vehicleSummaries: VehicleSummary[];
}

export interface TimeSlotVehicle {
  id: number;
  location: string;
  bookDateTime: string; // ISO datetime
  wanted: number | null;
  vehicleTypes: string[];
}

export interface LocationSummary {
  location: string;
  totalCouriers: number;
  totalAvailable: number;
  scheduleSummaries: ScheduleSummary[];
  timeSlots: TimeSlotVehicle[];
}

export interface CourierDetails {
  id: number;
  code: string;
  firstName: string;
  surname: string;
  mobile: string;
  vehicleType: string;
  region: string;
  active: boolean;
}

export interface ScheduleResponse {
  id: number;
  created: string;
  updated: string;
  statusId: number; // 0=pending(no response), 1=available, 2=unavailable, 3=cancelled
  status: string;
  timeSlot: { id: number; location: string; bookDateTime: string; wanted: number | null } | null;
}

export interface CourierBySchedule {
  courier: CourierDetails;
  scheduleResponse: ScheduleResponse | null;
}

export interface ScheduleDto {
  id: number;
  created: string;
  bookDate: string;
  location: string;
  name: string;
  notificationSent: string | null;
  startTime: string;
  endTime: string;
  wanted: number;
}

// Vehicle types available
export const VEHICLE_TYPES = ['Car', 'Van', 'Truck', 'Motorcycle', 'Bicycle', 'E-Bike'];

// Locations (depots/regions)
export const LOCATIONS = [
  { id: 1, name: 'AUCKLAND' },
  { id: 2, name: 'WELLINGTON' },
  { id: 3, name: 'CHRISTCHURCH' },
  { id: 4, name: 'HAMILTON' },
];

// Helper to get date string
const today = new Date();
const fmt = (d: Date) => d.toISOString().split('T')[0];
const todayStr = fmt(today);
const tomorrowStr = fmt(new Date(today.getTime() + 86400000));

// ─── Mock Schedules for today ───

export const MOCK_LOCATION_SUMMARIES: LocationSummary[] = [
  {
    location: 'AUCKLAND',
    totalCouriers: 45,
    totalAvailable: 32,
    scheduleSummaries: [
      {
        id: 1, created: '2026-03-06T10:00:00', bookDate: todayStr,
        location: 'AUCKLAND', name: 'Morning Bulk',
        notificationSent: '2026-03-06T14:30:00',
        startTime: '06:00:00', endTime: '12:00:00',
        wanted: 20, available: 18,
        vehicleSummaries: [
          { vehicle: 'Van', available: 10, total: 18 },
          { vehicle: 'Car', available: 6, total: 15 },
          { vehicle: 'Truck', available: 2, total: 5 },
        ],
      },
      {
        id: 2, created: '2026-03-06T10:05:00', bookDate: todayStr,
        location: 'AUCKLAND', name: 'Afternoon Express',
        notificationSent: '2026-03-06T14:30:00',
        startTime: '12:00:00', endTime: '18:00:00',
        wanted: 15, available: 15,
        vehicleSummaries: [
          { vehicle: 'Van', available: 8, total: 18 },
          { vehicle: 'Car', available: 5, total: 15 },
          { vehicle: 'Motorcycle', available: 2, total: 7 },
        ],
      },
      {
        id: 3, created: '2026-03-06T10:10:00', bookDate: todayStr,
        location: 'AUCKLAND', name: 'Evening Run',
        notificationSent: null,
        startTime: '18:00:00', endTime: '22:00:00',
        wanted: 10, available: 0,
        vehicleSummaries: [
          { vehicle: 'Van', available: 0, total: 18 },
          { vehicle: 'Car', available: 0, total: 15 },
        ],
      },
    ],
    timeSlots: [
      { id: 101, location: 'AUCKLAND', bookDateTime: `${todayStr}T06:30:00`, wanted: 5, vehicleTypes: ['Van'] },
      { id: 102, location: 'AUCKLAND', bookDateTime: `${todayStr}T07:00:00`, wanted: 8, vehicleTypes: ['Van', 'Car'] },
      { id: 103, location: 'AUCKLAND', bookDateTime: `${todayStr}T08:00:00`, wanted: 4, vehicleTypes: ['Truck'] },
      { id: 104, location: 'AUCKLAND', bookDateTime: `${todayStr}T09:30:00`, wanted: 3, vehicleTypes: [] },
      { id: 105, location: 'AUCKLAND', bookDateTime: `${todayStr}T12:30:00`, wanted: 6, vehicleTypes: ['Van', 'Car'] },
      { id: 106, location: 'AUCKLAND', bookDateTime: `${todayStr}T14:00:00`, wanted: 5, vehicleTypes: ['Motorcycle'] },
    ],
  },
  {
    location: 'WELLINGTON',
    totalCouriers: 28,
    totalAvailable: 19,
    scheduleSummaries: [
      {
        id: 4, created: '2026-03-06T10:00:00', bookDate: todayStr,
        location: 'WELLINGTON', name: 'AM Delivery',
        notificationSent: '2026-03-06T15:00:00',
        startTime: '07:00:00', endTime: '13:00:00',
        wanted: 12, available: 10,
        vehicleSummaries: [
          { vehicle: 'Van', available: 6, total: 12 },
          { vehicle: 'Car', available: 3, total: 10 },
          { vehicle: 'E-Bike', available: 1, total: 3 },
        ],
      },
      {
        id: 5, created: '2026-03-06T10:05:00', bookDate: todayStr,
        location: 'WELLINGTON', name: 'PM Delivery',
        notificationSent: null,
        startTime: '13:00:00', endTime: '19:00:00',
        wanted: 8, available: 0,
        vehicleSummaries: [
          { vehicle: 'Van', available: 0, total: 12 },
          { vehicle: 'Car', available: 0, total: 10 },
        ],
      },
    ],
    timeSlots: [
      { id: 201, location: 'WELLINGTON', bookDateTime: `${todayStr}T07:30:00`, wanted: 4, vehicleTypes: ['Van'] },
      { id: 202, location: 'WELLINGTON', bookDateTime: `${todayStr}T09:00:00`, wanted: 5, vehicleTypes: ['Van', 'Car'] },
      { id: 203, location: 'WELLINGTON', bookDateTime: `${todayStr}T11:00:00`, wanted: 3, vehicleTypes: ['E-Bike'] },
    ],
  },
  {
    location: 'CHRISTCHURCH',
    totalCouriers: 22,
    totalAvailable: 14,
    scheduleSummaries: [
      {
        id: 6, created: '2026-03-06T10:00:00', bookDate: todayStr,
        location: 'CHRISTCHURCH', name: 'Full Day',
        notificationSent: '2026-03-06T16:00:00',
        startTime: '08:00:00', endTime: '17:00:00',
        wanted: 14, available: 12,
        vehicleSummaries: [
          { vehicle: 'Van', available: 7, total: 10 },
          { vehicle: 'Car', available: 4, total: 8 },
          { vehicle: 'Bicycle', available: 1, total: 2 },
        ],
      },
    ],
    timeSlots: [
      { id: 301, location: 'CHRISTCHURCH', bookDateTime: `${todayStr}T08:30:00`, wanted: 6, vehicleTypes: ['Van', 'Car'] },
      { id: 302, location: 'CHRISTCHURCH', bookDateTime: `${todayStr}T12:00:00`, wanted: 4, vehicleTypes: [] },
    ],
  },
];

// ─── Mock courier responses for schedule id=1 (Morning Bulk) ───

const makeResponse = (id: number, courierId: number, statusId: number, status: string, timeSlotId: number | null, timeSlotTime: string | null): ScheduleResponse => ({
  id,
  created: '2026-03-06T15:00:00',
  updated: '2026-03-06T18:30:00',
  statusId,
  status,
  timeSlot: timeSlotId ? { id: timeSlotId, location: 'AUCKLAND', bookDateTime: `${todayStr}T${timeSlotTime}`, wanted: 5 } : null,
});

const makeCourier = (id: number, code: string, first: string, last: string, mobile: string, vehicle: string): CourierDetails => ({
  id, code, firstName: first, surname: last, mobile, vehicleType: vehicle, region: 'AUCKLAND', active: true,
});

export const MOCK_COURIER_RESPONSES_BY_SCHEDULE: Record<number, CourierBySchedule[]> = {
  1: [
    // Available (statusId=1)
    { courier: makeCourier(1001, 'AKL001', 'James', 'Wilson', '021-555-0101', 'Van'), scheduleResponse: makeResponse(5001, 1001, 1, 'Available', 101, '06:30:00') },
    { courier: makeCourier(1002, 'AKL002', 'Sarah', 'Chen', '021-555-0102', 'Van'), scheduleResponse: makeResponse(5002, 1002, 1, 'Available', 102, '07:00:00') },
    { courier: makeCourier(1003, 'AKL003', 'Mike', 'Taylor', '021-555-0103', 'Car'), scheduleResponse: makeResponse(5003, 1003, 1, 'Available', 102, '07:00:00') },
    { courier: makeCourier(1004, 'AKL004', 'Lisa', 'Brown', '021-555-0104', 'Van'), scheduleResponse: makeResponse(5004, 1004, 1, 'Available', null, null) },
    { courier: makeCourier(1005, 'AKL005', 'Tom', 'Nguyen', '021-555-0105', 'Truck'), scheduleResponse: makeResponse(5005, 1005, 1, 'Available', 103, '08:00:00') },
    { courier: makeCourier(1006, 'AKL006', 'Emma', 'Davis', '021-555-0106', 'Car'), scheduleResponse: makeResponse(5006, 1006, 1, 'Available', 104, '09:30:00') },
    { courier: makeCourier(1007, 'AKL007', 'Daniel', 'Lee', '021-555-0107', 'Van'), scheduleResponse: makeResponse(5007, 1007, 1, 'Available', 101, '06:30:00') },
    { courier: makeCourier(1008, 'AKL008', 'Amy', 'Patel', '021-555-0108', 'Car'), scheduleResponse: makeResponse(5008, 1008, 1, 'Available', null, null) },
    { courier: makeCourier(1009, 'AKL009', 'Chris', 'Martin', '021-555-0109', 'Van'), scheduleResponse: makeResponse(5009, 1009, 1, 'Available', 102, '07:00:00') },
    { courier: makeCourier(1010, 'AKL010', 'Rachel', 'Kim', '021-555-0110', 'Van'), scheduleResponse: makeResponse(5010, 1010, 1, 'Available', 101, '06:30:00') },
    { courier: makeCourier(1011, 'AKL011', 'Ben', 'White', '021-555-0111', 'Truck'), scheduleResponse: makeResponse(5011, 1011, 1, 'Available', 103, '08:00:00') },
    { courier: makeCourier(1012, 'AKL012', 'Sophie', 'Jones', '021-555-0112', 'Car'), scheduleResponse: makeResponse(5012, 1012, 1, 'Available', null, null) },
    { courier: makeCourier(1013, 'AKL013', 'Kevin', 'Shah', '021-555-0113', 'Van'), scheduleResponse: makeResponse(5013, 1013, 1, 'Available', 104, '09:30:00') },
    { courier: makeCourier(1014, 'AKL014', 'Mia', 'Thompson', '021-555-0114', 'Car'), scheduleResponse: makeResponse(5014, 1014, 1, 'Available', 102, '07:00:00') },
    { courier: makeCourier(1015, 'AKL015', 'Jack', 'Anderson', '021-555-0115', 'Van'), scheduleResponse: makeResponse(5015, 1015, 1, 'Available', null, null) },
    { courier: makeCourier(1016, 'AKL016', 'Olivia', 'Garcia', '021-555-0116', 'Van'), scheduleResponse: makeResponse(5016, 1016, 1, 'Available', 101, '06:30:00') },
    { courier: makeCourier(1017, 'AKL017', 'Liam', 'Robinson', '021-555-0117', 'Car'), scheduleResponse: makeResponse(5017, 1017, 1, 'Available', null, null) },
    { courier: makeCourier(1018, 'AKL018', 'Grace', 'Clark', '021-555-0118', 'Van'), scheduleResponse: makeResponse(5018, 1018, 1, 'Available', 104, '09:30:00') },
    // Unavailable (statusId=2)
    { courier: makeCourier(1019, 'AKL019', 'Noah', 'Wright', '021-555-0119', 'Van'), scheduleResponse: makeResponse(5019, 1019, 2, 'Unavailable', null, null) },
    { courier: makeCourier(1020, 'AKL020', 'Ella', 'Scott', '021-555-0120', 'Car'), scheduleResponse: makeResponse(5020, 1020, 2, 'Unavailable', null, null) },
    { courier: makeCourier(1021, 'AKL021', 'Ethan', 'Hall', '021-555-0121', 'Truck'), scheduleResponse: makeResponse(5021, 1021, 2, 'Unavailable', null, null) },
    { courier: makeCourier(1022, 'AKL022', 'Zoe', 'Walker', '021-555-0122', 'Van'), scheduleResponse: makeResponse(5022, 1022, 2, 'Unavailable', null, null) },
    { courier: makeCourier(1023, 'AKL023', 'Lucas', 'Young', '021-555-0123', 'Car'), scheduleResponse: makeResponse(5023, 1023, 2, 'Unavailable', null, null) },
    // Pending (no response)
    { courier: makeCourier(1024, 'AKL024', 'Hannah', 'King', '021-555-0124', 'Van'), scheduleResponse: null },
    { courier: makeCourier(1025, 'AKL025', 'Oscar', 'Green', '021-555-0125', 'Car'), scheduleResponse: null },
    { courier: makeCourier(1026, 'AKL026', 'Isabella', 'Baker', '021-555-0126', 'Van'), scheduleResponse: null },
    { courier: makeCourier(1027, 'AKL027', 'Alexander', 'Adams', '021-555-0127', 'Motorcycle'), scheduleResponse: null },
    { courier: makeCourier(1028, 'AKL028', 'Charlotte', 'Nelson', '021-555-0128', 'E-Bike'), scheduleResponse: null },
    { courier: makeCourier(1029, 'AKL029', 'Mason', 'Hill', '021-555-0129', 'Van'), scheduleResponse: null },
    { courier: makeCourier(1030, 'AKL030', 'Ava', 'Mitchell', '021-555-0130', 'Car'), scheduleResponse: null },
  ],
  2: [
    { courier: makeCourier(1001, 'AKL001', 'James', 'Wilson', '021-555-0101', 'Van'), scheduleResponse: makeResponse(6001, 1001, 1, 'Available', 105, '12:30:00') },
    { courier: makeCourier(1003, 'AKL003', 'Mike', 'Taylor', '021-555-0103', 'Car'), scheduleResponse: makeResponse(6002, 1003, 1, 'Available', 105, '12:30:00') },
    { courier: makeCourier(1006, 'AKL006', 'Emma', 'Davis', '021-555-0106', 'Car'), scheduleResponse: makeResponse(6003, 1006, 1, 'Available', null, null) },
    { courier: makeCourier(1027, 'AKL027', 'Alexander', 'Adams', '021-555-0127', 'Motorcycle'), scheduleResponse: makeResponse(6004, 1027, 1, 'Available', 106, '14:00:00') },
    { courier: makeCourier(1002, 'AKL002', 'Sarah', 'Chen', '021-555-0102', 'Van'), scheduleResponse: makeResponse(6005, 1002, 2, 'Unavailable', null, null) },
    { courier: makeCourier(1024, 'AKL024', 'Hannah', 'King', '021-555-0124', 'Van'), scheduleResponse: null },
    { courier: makeCourier(1025, 'AKL025', 'Oscar', 'Green', '021-555-0125', 'Car'), scheduleResponse: null },
  ],
  4: [
    { courier: makeCourier(2001, 'WLG001', 'David', 'Murphy', '022-555-0201', 'Van'), scheduleResponse: makeResponse(7001, 2001, 1, 'Available', 201, '07:30:00') },
    { courier: makeCourier(2002, 'WLG002', 'Kate', 'O\'Brien', '022-555-0202', 'Car'), scheduleResponse: makeResponse(7002, 2002, 1, 'Available', 202, '09:00:00') },
    { courier: makeCourier(2003, 'WLG003', 'Ryan', 'Sullivan', '022-555-0203', 'Van'), scheduleResponse: makeResponse(7003, 2003, 1, 'Available', null, null) },
    { courier: makeCourier(2004, 'WLG004', 'Emily', 'Byrne', '022-555-0204', 'E-Bike'), scheduleResponse: makeResponse(7004, 2004, 1, 'Available', 203, '11:00:00') },
    { courier: makeCourier(2005, 'WLG005', 'Sean', 'Doyle', '022-555-0205', 'Van'), scheduleResponse: makeResponse(7005, 2005, 2, 'Unavailable', null, null) },
    { courier: makeCourier(2006, 'WLG006', 'Fiona', 'Walsh', '022-555-0206', 'Car'), scheduleResponse: null },
    { courier: makeCourier(2007, 'WLG007', 'Patrick', 'Kelly', '022-555-0207', 'Van'), scheduleResponse: null },
  ],
  6: [
    { courier: makeCourier(3001, 'CHC001', 'Mark', 'Turner', '023-555-0301', 'Van'), scheduleResponse: makeResponse(8001, 3001, 1, 'Available', 301, '08:30:00') },
    { courier: makeCourier(3002, 'CHC002', 'Anna', 'Cooper', '023-555-0302', 'Car'), scheduleResponse: makeResponse(8002, 3002, 1, 'Available', 301, '08:30:00') },
    { courier: makeCourier(3003, 'CHC003', 'Peter', 'Edwards', '023-555-0303', 'Van'), scheduleResponse: makeResponse(8003, 3003, 1, 'Available', 302, '12:00:00') },
    { courier: makeCourier(3004, 'CHC004', 'Laura', 'Hughes', '023-555-0304', 'Bicycle'), scheduleResponse: makeResponse(8004, 3004, 1, 'Available', null, null) },
    { courier: makeCourier(3005, 'CHC005', 'George', 'Morris', '023-555-0305', 'Car'), scheduleResponse: makeResponse(8005, 3005, 2, 'Unavailable', null, null) },
    { courier: makeCourier(3006, 'CHC006', 'Helen', 'Ward', '023-555-0306', 'Van'), scheduleResponse: null },
  ],
};

// Mock pending notifications (un-notified schedules)
export const MOCK_PENDING_NOTIFICATIONS: ScheduleDto[] = [
  {
    id: 3, created: '2026-03-06T10:10:00', bookDate: todayStr,
    location: 'AUCKLAND', name: 'Evening Run',
    notificationSent: null,
    startTime: '18:00:00', endTime: '22:00:00', wanted: 10,
  },
  {
    id: 5, created: '2026-03-06T10:05:00', bookDate: todayStr,
    location: 'WELLINGTON', name: 'PM Delivery',
    notificationSent: null,
    startTime: '13:00:00', endTime: '19:00:00', wanted: 8,
  },
  {
    id: 10, created: '2026-03-07T09:00:00', bookDate: tomorrowStr,
    location: 'AUCKLAND', name: 'Morning Express',
    notificationSent: null,
    startTime: '06:00:00', endTime: '11:00:00', wanted: 15,
  },
  {
    id: 11, created: '2026-03-07T09:00:00', bookDate: tomorrowStr,
    location: 'HAMILTON', name: 'All Day',
    notificationSent: null,
    startTime: '07:00:00', endTime: '18:00:00', wanted: 8,
  },
];
