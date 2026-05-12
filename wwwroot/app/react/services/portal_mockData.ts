// ═══════════════════════════════════════════════════════
// Portal Mock Data — Replace with real API calls
// ═══════════════════════════════════════════════════════

export type Country = 'NZ' | 'US';

export function detectCountry(): Country {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    if (tz.startsWith('Pacific/Auckland') || tz.startsWith('NZ')) return 'NZ';
  } catch { /* fall through */ }
  return 'US';
}

// ── Courier Profile ────────────────────────────────────

export interface CourierProfile {
  id: number;
  code: string;
  firstName: string;
  surname: string;
  email: string;
  mobile: string;
  taxNo: string;
  bankAccountNo: string;
  bankRoutingNumber?: string;
  address: string;
  isMasterCourier: boolean;
  country: Country;
}

export const mockCourier: CourierProfile = {
  id: 101,
  code: 'COU-101',
  firstName: 'James',
  surname: 'Carter',
  email: 'james.carter@example.com',
  mobile: '+64 21 555 1234',
  taxNo: '123-456-789',
  bankAccountNo: '01-0123-0123456-00',
  address: '42 Queen Street, Auckland 1010',
  isMasterCourier: true,
  country: 'NZ',
};

// ── Schedule / Availability ────────────────────────────

export interface TimeSlot {
  id: number;
  bookDateTime: string; // ISO
  remaining: number | null;
  wanted: boolean;
}

export interface Schedule {
  id: number;
  name: string;
  location: string;
  bookDate: string; // ISO date
  startTime: string; // HH:mm:ss
  endTime: string; // HH:mm:ss
  wanted: number;
  timeSlots: TimeSlot[];
  hasTimeSlots: boolean;
  response: { statusId: 1 | 2 | 3; timeSlot?: TimeSlot } | null;
}

function futureDate(daysAhead: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return d.toISOString().split('T')[0];
}

export const mockSchedules: Schedule[] = [
  {
    id: 1, name: 'Auckland CBD Morning', location: 'Auckland CBD', bookDate: futureDate(1),
    startTime: '06:00:00', endTime: '10:00:00', wanted: 3, hasTimeSlots: true,
    timeSlots: [
      { id: 11, bookDateTime: `${futureDate(1)}T06:00:00`, remaining: 2, wanted: true },
      { id: 12, bookDateTime: `${futureDate(1)}T07:30:00`, remaining: 0, wanted: true },
      { id: 13, bookDateTime: `${futureDate(1)}T09:00:00`, remaining: 1, wanted: true },
    ],
    response: null,
  },
  {
    id: 2, name: 'North Shore Afternoon', location: 'North Shore', bookDate: futureDate(2),
    startTime: '12:00:00', endTime: '17:00:00', wanted: 2, hasTimeSlots: false, timeSlots: [],
    response: null,
  },
  {
    id: 3, name: 'South Auckland Express', location: 'Manukau', bookDate: futureDate(3),
    startTime: '08:00:00', endTime: '14:00:00', wanted: 4, hasTimeSlots: false, timeSlots: [],
    response: { statusId: 1 },
  },
  {
    id: 4, name: 'West Auckland Run', location: 'Henderson', bookDate: futureDate(4),
    startTime: '07:00:00', endTime: '11:00:00', wanted: 2, hasTimeSlots: true,
    timeSlots: [
      { id: 41, bookDateTime: `${futureDate(4)}T07:00:00`, remaining: 0, wanted: true },
      { id: 42, bookDateTime: `${futureDate(4)}T09:00:00`, remaining: 0, wanted: true },
    ],
    response: { statusId: 1, timeSlot: { id: 41, bookDateTime: `${futureDate(4)}T07:00:00`, remaining: 0, wanted: true } },
  },
  {
    id: 5, name: 'East Tamaki Industrial', location: 'East Tamaki', bookDate: futureDate(1),
    startTime: '09:00:00', endTime: '15:00:00', wanted: 1, hasTimeSlots: false, timeSlots: [],
    response: { statusId: 2 },
  },
  {
    id: 6, name: 'Hamilton Intercity', location: 'Hamilton', bookDate: futureDate(5),
    startTime: '05:00:00', endTime: '12:00:00', wanted: 1, hasTimeSlots: false, timeSlots: [],
    response: { statusId: 3 },
  },
];

// ── Runs ───────────────────────────────────────────────

export interface Job {
  id: number;
  pickupAddress: string;
  deliveryAddress: string;
  status: 'Pending' | 'In Transit' | 'Delivered' | 'Failed';
  podSigned: boolean;
  podSignedAt?: string;
  notes?: string;
}

export interface Run {
  id: number;
  name: string;
  location: string;
  bookDate: string;
  startTime: string;
  endTime: string;
  status: 'Upcoming' | 'In Progress' | 'Completed';
  jobs: Job[];
}

export const mockRuns: Run[] = [
  {
    id: 201, name: 'Auckland CBD Morning', location: 'Auckland CBD',
    bookDate: futureDate(0), startTime: '06:00', endTime: '10:00', status: 'In Progress',
    jobs: [
      { id: 1001, pickupAddress: '15 Queen St, Auckland', deliveryAddress: '42 Symonds St, Auckland', status: 'Delivered', podSigned: true, podSignedAt: '2024-03-07T08:15:00' },
      { id: 1002, pickupAddress: '88 Albert St, Auckland', deliveryAddress: '5 Ponsonby Rd, Auckland', status: 'In Transit', podSigned: false },
      { id: 1003, pickupAddress: '200 Broadway, Newmarket', deliveryAddress: '10 Karangahape Rd, Auckland', status: 'Pending', podSigned: false },
    ],
  },
  {
    id: 202, name: 'North Shore Afternoon', location: 'North Shore',
    bookDate: futureDate(1), startTime: '12:00', endTime: '17:00', status: 'Upcoming',
    jobs: [
      { id: 1004, pickupAddress: '1 Hurstmere Rd, Takapuna', deliveryAddress: '50 Anzac St, Takapuna', status: 'Pending', podSigned: false },
      { id: 1005, pickupAddress: '25 Lake Rd, Devonport', deliveryAddress: '12 Victoria Rd, Devonport', status: 'Pending', podSigned: false },
    ],
  },
  {
    id: 203, name: 'South Auckland Express', location: 'Manukau',
    bookDate: futureDate(-1), startTime: '08:00', endTime: '14:00', status: 'Completed',
    jobs: [
      { id: 1006, pickupAddress: '3 Ronwood Ave, Manukau', deliveryAddress: '18 Great South Rd, Papakura', status: 'Delivered', podSigned: true, podSignedAt: '2024-03-06T11:30:00' },
      { id: 1007, pickupAddress: '7 Cavendish Dr, Manukau', deliveryAddress: '22 Station Rd, Otahuhu', status: 'Delivered', podSigned: true, podSignedAt: '2024-03-06T13:45:00' },
    ],
  },
  {
    id: 204, name: 'West Auckland Run', location: 'Henderson',
    bookDate: futureDate(-3), startTime: '07:00', endTime: '11:00', status: 'Completed',
    jobs: [
      { id: 1008, pickupAddress: '5 Lincoln Rd, Henderson', deliveryAddress: '30 Universal Dr, Henderson', status: 'Delivered', podSigned: true },
      { id: 1009, pickupAddress: '12 Swanson Rd, Swanson', deliveryAddress: '8 Waitakere Rd, Titirangi', status: 'Failed', podSigned: false, notes: 'No access to premises' },
    ],
  },
];

// ── Invoicing ──────────────────────────────────────────

export interface InvoiceRun {
  bookDate: string;
  runName: string;
  amount: number;
  masterAmount?: number;
}

export interface UninvoicedData {
  courier: {
    runs: InvoiceRun[];
    subtotal: number;
    gstPercentage: number;
    gstAmount: number;
    withholdingTaxPercentage: number;
    withholdingTaxAmount: number;
    total: number;
  };
  masters: {
    runs: InvoiceRun[];
    subtotal: number;
    gstPercentage: number;
    gstAmount: number;
    withholdingTaxPercentage: number;
    withholdingTaxAmount: number;
    total: number;
  }[];
  toAddress: string;
}

export function getMockUninvoiced(country: Country): UninvoicedData {
  const subtotal = 485.00;
  const gstAmt = country === 'NZ' ? subtotal * 0.15 : 0;
  const whAmt = country === 'US' ? subtotal * 0.28 : 0;
  return {
    courier: {
      runs: [
        { bookDate: futureDate(-3), runName: 'West Auckland Run', amount: 185.00 },
        { bookDate: futureDate(-1), runName: 'South Auckland Express', amount: 300.00 },
      ],
      subtotal,
      gstPercentage: country === 'NZ' ? 15 : 0,
      gstAmount: gstAmt,
      withholdingTaxPercentage: country === 'US' ? 28 : 0,
      withholdingTaxAmount: whAmt,
      total: subtotal + gstAmt - whAmt,
    },
    masters: [],
    toAddress: country === 'NZ'
      ? 'Urgent Couriers Limited\nP.O. Box 6395\nWellesley Street\nAuckland 1141'
      : 'Express Delivery Corp\n123 Main Street\nNew York, NY 10001',
  };
}

export interface InvoiceLine {
  description: string;
  total: number;
}

export interface Invoice {
  invoiceNo: string;
  created: string;
  reference: string;
  taxNo: string;
  toAddress: string;
  subtotal: number;
  gstPercentage: number;
  gstAmount: number;
  withholdingTaxPercentage: number;
  withholdingTaxAmount: number;
  total: number;
  lines: InvoiceLine[];
  status: 'Paid' | 'Pending' | 'Overdue';
}

export const mockRecentInvoices: Invoice[] = [
  {
    invoiceNo: 'INV-2024-0042', created: futureDate(-7), reference: 'COU-101', taxNo: '123-456-789',
    toAddress: 'Urgent Couriers Limited', subtotal: 720, gstPercentage: 15, gstAmount: 108,
    withholdingTaxPercentage: 0, withholdingTaxAmount: 0, total: 828, status: 'Paid',
    lines: [
      { description: '04 Mar : Auckland CBD Morning', total: 250 },
      { description: '04 Mar : North Shore Afternoon', total: 220 },
      { description: '05 Mar : East Tamaki Industrial', total: 250 },
    ],
  },
  {
    invoiceNo: 'INV-2024-0041', created: futureDate(-14), reference: 'COU-101', taxNo: '123-456-789',
    toAddress: 'Urgent Couriers Limited', subtotal: 540, gstPercentage: 15, gstAmount: 81,
    withholdingTaxPercentage: 0, withholdingTaxAmount: 0, total: 621, status: 'Pending',
    lines: [
      { description: '25 Feb : South Auckland Express', total: 300 },
      { description: '26 Feb : West Auckland Run', total: 240 },
    ],
  },
];

export const mockPastInvoices: Invoice[] = Array.from({ length: 30 }, (_, i) => ({
  invoiceNo: `INV-2024-${String(40 - i).padStart(4, '0')}`,
  created: futureDate(-21 - i * 7),
  reference: 'COU-101', taxNo: '123-456-789', toAddress: 'Urgent Couriers Limited',
  subtotal: 400 + Math.round(Math.random() * 400),
  gstPercentage: 15, gstAmount: 0, withholdingTaxPercentage: 0, withholdingTaxAmount: 0,
  total: 0, status: (i % 3 === 0 ? 'Overdue' : 'Paid') as Invoice['status'],
  lines: [{ description: `Run batch ${40 - i}`, total: 400 + Math.round(Math.random() * 400) }],
})).map(inv => ({ ...inv, gstAmount: inv.subtotal * 0.15, total: inv.subtotal * 1.15 }));

// ── Subcontractors ─────────────────────────────────────

export interface Subcontractor {
  id: number;
  name: string;
  code: string;
  phone: string;
  runsCompleted: number;
  totalEarnings: number;
  status: 'Active' | 'Inactive';
}

export const mockSubcontractors: Subcontractor[] = [
  { id: 301, name: 'Sarah Mitchell', code: 'COU-301', phone: '+64 21 555 5678', runsCompleted: 42, totalEarnings: 8400, status: 'Active' },
  { id: 302, name: 'Tom Walker', code: 'COU-302', phone: '+64 21 555 9012', runsCompleted: 28, totalEarnings: 5600, status: 'Active' },
  { id: 303, name: 'Lisa Chen', code: 'COU-303', phone: '+64 21 555 3456', runsCompleted: 15, totalEarnings: 3000, status: 'Inactive' },
];

// ── Reports ────────────────────────────────────────────

export interface ReportSummary {
  totalRuns: number;
  totalEarnings: number;
  avgPerRun: number;
  thisWeekRuns: number;
  thisWeekEarnings: number;
  thisMonthRuns: number;
  thisMonthEarnings: number;
  weeklyData: { week: string; runs: number; earnings: number }[];
}

export const mockReportSummary: ReportSummary = {
  totalRuns: 156,
  totalEarnings: 31200,
  avgPerRun: 200,
  thisWeekRuns: 4,
  thisWeekEarnings: 800,
  thisMonthRuns: 18,
  thisMonthEarnings: 3600,
  weeklyData: [
    { week: 'W1 Feb', runs: 5, earnings: 1000 },
    { week: 'W2 Feb', runs: 4, earnings: 800 },
    { week: 'W3 Feb', runs: 6, earnings: 1200 },
    { week: 'W4 Feb', runs: 3, earnings: 600 },
    { week: 'W1 Mar', runs: 4, earnings: 800 },
  ],
};
