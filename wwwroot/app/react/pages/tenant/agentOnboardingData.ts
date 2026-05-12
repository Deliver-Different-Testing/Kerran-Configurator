export type BusinessOnboardingStage =
  | 'Prospect Identified'
  | 'Contacted'
  | 'Qualified'
  | 'Documents Requested'
  | 'Documents Received'
  | 'Review In Progress'
  | 'Approved'
  | 'Activated'
  | 'Rejected / Archived';

export interface ComplianceItem {
  id: string;
  label: string;
  status: 'complete' | 'in_progress' | 'missing';
  updatedAt: string;
}

export interface TimelineItem {
  id: string;
  title: string;
  detail: string;
  owner: string;
  timestamp: string;
}

export interface BusinessOnboardingRecord {
  id: number;
  linkedAgentId?: number;
  businessName: string;
  primaryContact: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  state: string;
  coverage: string[];
  association: 'ECA' | 'CLDA' | 'None';
  memberId?: string;
  source: 'Directory Search' | 'Referral' | 'Outbound' | 'Manual Entry' | 'Imported Lead';
  stage: BusinessOnboardingStage;
  networkPartnerStatus: 'Candidate' | 'Approved NP' | 'Agent Only' | 'Archived';
  fleetProfile: string;
  estimatedDrivers: number;
  serviceCapabilities: string[];
  specialties: string[];
  notes: string;
  complianceItems: ComplianceItem[];
  complianceComplete: boolean;
  reviewer: string;
  owner: string;
  lastUpdated: string;
  createdAt: string;
  archived: boolean;
}

export const BUSINESS_ONBOARDING_STAGES: BusinessOnboardingStage[] = [
  'Prospect Identified',
  'Contacted',
  'Qualified',
  'Documents Requested',
  'Documents Received',
  'Review In Progress',
  'Approved',
  'Activated',
  'Rejected / Archived',
];

export const STAGE_TONE: Record<BusinessOnboardingStage, string> = {
  'Prospect Identified': 'bg-sky-100 text-sky-700',
  Contacted: 'bg-indigo-100 text-indigo-700',
  Qualified: 'bg-violet-100 text-violet-700',
  'Documents Requested': 'bg-amber-100 text-amber-700',
  'Documents Received': 'bg-orange-100 text-orange-700',
  'Review In Progress': 'bg-cyan-100 text-cyan-700',
  Approved: 'bg-emerald-100 text-emerald-700',
  Activated: 'bg-green-100 text-green-700',
  'Rejected / Archived': 'bg-slate-200 text-slate-700',
};

export const BUSINESS_ONBOARDING_SEED: BusinessOnboardingRecord[] = [
  {
    id: 201,
    linkedAgentId: 1,
    businessName: 'Metro Express Couriers',
    primaryContact: 'John Smith',
    phone: '+1 312-555-0101',
    email: 'john@metroexpress.com',
    address: '142 N Michigan Ave',
    city: 'Chicago',
    state: 'IL',
    coverage: ['Chicago', 'Oak Brook', 'Naperville'],
    association: 'ECA',
    memberId: 'ECA-1234',
    source: 'Directory Search',
    stage: 'Review In Progress',
    networkPartnerStatus: 'Candidate',
    fleetProfile: '28 sedans, 14 cargo vans, 6 refrigerated vans',
    estimatedDrivers: 54,
    serviceCapabilities: ['Same Day', 'Medical', 'Scheduled Routes'],
    specialties: ['Hospital systems', 'STAT pharmacy'],
    notes: 'Strong metro footprint and existing healthcare experience. Pending insurance confirmation for two satellite depots.',
    complianceItems: [
      { id: 'insurance', label: 'Insurance certificate', status: 'complete', updatedAt: '2026-03-06' },
      { id: 'authority', label: 'Operating authority / registration', status: 'complete', updatedAt: '2026-03-05' },
      { id: 'msa', label: 'Master services agreement', status: 'in_progress', updatedAt: '2026-03-07' },
      { id: 'tax', label: 'Tax verification', status: 'complete', updatedAt: '2026-03-04' },
    ],
    complianceComplete: false,
    reviewer: 'Natalie Brooks',
    owner: 'Evan Turner',
    lastUpdated: '2026-03-07',
    createdAt: '2026-02-26',
    archived: false,
  },
  {
    id: 202,
    linkedAgentId: 2,
    businessName: 'Lone Star Logistics',
    primaryContact: 'Sarah Chen',
    phone: '+1 214-555-0202',
    email: 'sarah@lonestarlogi.com',
    address: '870 Commerce St',
    city: 'Dallas',
    state: 'TX',
    coverage: ['Dallas', 'Fort Worth', 'Plano'],
    association: 'CLDA',
    memberId: 'CLDA-5678',
    source: 'Referral',
    stage: 'Approved',
    networkPartnerStatus: 'Approved NP',
    fleetProfile: '21 vans, 7 box trucks',
    estimatedDrivers: 41,
    serviceCapabilities: ['Same Day', 'Freight', 'After Hours'],
    specialties: ['Retail overflow', 'White glove'],
    notes: 'Commercial terms approved. Ready for portal activation and directory publish.',
    complianceItems: [
      { id: 'insurance', label: 'Insurance certificate', status: 'complete', updatedAt: '2026-03-02' },
      { id: 'authority', label: 'Operating authority / registration', status: 'complete', updatedAt: '2026-03-01' },
      { id: 'msa', label: 'Master services agreement', status: 'complete', updatedAt: '2026-03-03' },
      { id: 'tax', label: 'Tax verification', status: 'complete', updatedAt: '2026-03-02' },
    ],
    complianceComplete: true,
    reviewer: 'Natalie Brooks',
    owner: 'Marcus Allen',
    lastUpdated: '2026-03-07',
    createdAt: '2026-02-20',
    archived: false,
  },
  {
    id: 203,
    businessName: 'Bayou Medical Delivery',
    primaryContact: 'Camille Duet',
    phone: '+1 504-555-0803',
    email: 'camille@bayoumed.com',
    address: '511 Poydras St',
    city: 'New Orleans',
    state: 'LA',
    coverage: ['New Orleans', 'Metairie', 'Baton Rouge'],
    association: 'None',
    source: 'Outbound',
    stage: 'Documents Requested',
    networkPartnerStatus: 'Candidate',
    fleetProfile: '12 vans, 4 temperature-controlled units',
    estimatedDrivers: 23,
    serviceCapabilities: ['Medical', 'Cold Chain', 'STAT'],
    specialties: ['Lab runs', 'Specimen transport'],
    notes: 'Good service fit. Waiting on authority paperwork and W-9.',
    complianceItems: [
      { id: 'insurance', label: 'Insurance certificate', status: 'in_progress', updatedAt: '2026-03-06' },
      { id: 'authority', label: 'Operating authority / registration', status: 'missing', updatedAt: '2026-03-06' },
      { id: 'msa', label: 'Master services agreement', status: 'missing', updatedAt: '2026-03-06' },
      { id: 'tax', label: 'Tax verification', status: 'missing', updatedAt: '2026-03-06' },
    ],
    complianceComplete: false,
    reviewer: 'Jordan Patel',
    owner: 'Mia Lewis',
    lastUpdated: '2026-03-06',
    createdAt: '2026-03-01',
    archived: false,
  },
  {
    id: 204,
    businessName: 'Cascade Delivery Services',
    primaryContact: 'Brian Park',
    phone: '+1 206-555-4004',
    email: 'brian@cascade-delivery.com',
    address: '920 5th Ave',
    city: 'Seattle',
    state: 'WA',
    coverage: ['Seattle', 'Bellevue', 'Tacoma'],
    association: 'ECA',
    memberId: 'ECA-4401',
    source: 'Imported Lead',
    stage: 'Qualified',
    networkPartnerStatus: 'Agent Only',
    fleetProfile: '18 vans, 10 hatchbacks',
    estimatedDrivers: 31,
    serviceCapabilities: ['On-Demand', 'Tech', 'Fragile'],
    specialties: ['Electronics', 'High-value'],
    notes: 'Regional fit is strong, but they prefer agent-only status unless volume warrants NP activation.',
    complianceItems: [
      { id: 'insurance', label: 'Insurance certificate', status: 'missing', updatedAt: '2026-03-04' },
      { id: 'authority', label: 'Operating authority / registration', status: 'missing', updatedAt: '2026-03-04' },
      { id: 'msa', label: 'Master services agreement', status: 'missing', updatedAt: '2026-03-04' },
      { id: 'tax', label: 'Tax verification', status: 'missing', updatedAt: '2026-03-04' },
    ],
    complianceComplete: false,
    reviewer: 'Jordan Patel',
    owner: 'Evan Turner',
    lastUpdated: '2026-03-05',
    createdAt: '2026-02-28',
    archived: false,
  },
  {
    id: 205,
    businessName: 'Heartland Express Co',
    primaryContact: 'Amy Walsh',
    phone: '+1 816-555-5005',
    email: 'amy@heartlandexpress.co',
    address: '101 Main St',
    city: 'Kansas City',
    state: 'MO',
    coverage: ['Kansas City', 'Overland Park'],
    association: 'CLDA',
    memberId: 'CLDA-9921',
    source: 'Manual Entry',
    stage: 'Prospect Identified',
    networkPartnerStatus: 'Candidate',
    fleetProfile: '8 vans, 5 cars',
    estimatedDrivers: 14,
    serviceCapabilities: ['Routed', 'Warehousing'],
    specialties: ['B2B scheduled work'],
    notes: 'New outbound target from Midwest expansion list.',
    complianceItems: [
      { id: 'insurance', label: 'Insurance certificate', status: 'missing', updatedAt: '2026-03-07' },
      { id: 'authority', label: 'Operating authority / registration', status: 'missing', updatedAt: '2026-03-07' },
      { id: 'msa', label: 'Master services agreement', status: 'missing', updatedAt: '2026-03-07' },
      { id: 'tax', label: 'Tax verification', status: 'missing', updatedAt: '2026-03-07' },
    ],
    complianceComplete: false,
    reviewer: 'Unassigned',
    owner: 'Marcus Allen',
    lastUpdated: '2026-03-07',
    createdAt: '2026-03-07',
    archived: false,
  },
  {
    id: 206,
    linkedAgentId: 6,
    businessName: 'Palmetto Rapid Transit',
    primaryContact: 'Carlos Reyes',
    phone: '+1 843-555-6006',
    email: 'carlos@palmettorapid.com',
    address: '42 Broad St',
    city: 'Charleston',
    state: 'SC',
    coverage: ['Charleston', 'North Charleston', 'Savannah'],
    association: 'ECA',
    memberId: 'ECA-6042',
    source: 'Directory Search',
    stage: 'Activated',
    networkPartnerStatus: 'Approved NP',
    fleetProfile: '16 cars, 11 vans',
    estimatedDrivers: 29,
    serviceCapabilities: ['Medical', 'Same Day', 'Airport'],
    specialties: ['Hospital systems', 'Specimen pickup'],
    notes: 'Activated in directory and handed off to operations.',
    complianceItems: [
      { id: 'insurance', label: 'Insurance certificate', status: 'complete', updatedAt: '2026-02-26' },
      { id: 'authority', label: 'Operating authority / registration', status: 'complete', updatedAt: '2026-02-26' },
      { id: 'msa', label: 'Master services agreement', status: 'complete', updatedAt: '2026-02-27' },
      { id: 'tax', label: 'Tax verification', status: 'complete', updatedAt: '2026-02-26' },
    ],
    complianceComplete: true,
    reviewer: 'Natalie Brooks',
    owner: 'Mia Lewis',
    lastUpdated: '2026-03-03',
    createdAt: '2026-02-18',
    archived: false,
  },
  {
    id: 207,
    linkedAgentId: 6,
    businessName: 'Harbor Freight Express',
    primaryContact: 'Alex Tan',
    phone: '+1 713-555-0606',
    email: 'alex@harborfreight.com',
    address: '77 Lamar St',
    city: 'Houston',
    state: 'TX',
    coverage: ['Houston'],
    association: 'None',
    source: 'Imported Lead',
    stage: 'Rejected / Archived',
    networkPartnerStatus: 'Archived',
    fleetProfile: 'Unknown',
    estimatedDrivers: 0,
    serviceCapabilities: ['Freight'],
    specialties: ['Long-haul'],
    notes: 'Archived after capability review. Does not support same-day city coverage needed for this tenant.',
    complianceItems: [
      { id: 'insurance', label: 'Insurance certificate', status: 'missing', updatedAt: '2026-02-25' },
      { id: 'authority', label: 'Operating authority / registration', status: 'missing', updatedAt: '2026-02-25' },
      { id: 'msa', label: 'Master services agreement', status: 'missing', updatedAt: '2026-02-25' },
      { id: 'tax', label: 'Tax verification', status: 'missing', updatedAt: '2026-02-25' },
    ],
    complianceComplete: false,
    reviewer: 'Jordan Patel',
    owner: 'Marcus Allen',
    lastUpdated: '2026-02-25',
    createdAt: '2026-02-21',
    archived: true,
  },
];

export function buildTimeline(record: BusinessOnboardingRecord): TimelineItem[] {
  const items: TimelineItem[] = [
    {
      id: `${record.id}-created`,
      title: 'Onboarding record created',
      detail: `${record.source} created the business prospect and opened the onboarding workspace.`,
      owner: record.owner,
      timestamp: record.createdAt,
    },
  ];

  if (record.stage !== 'Prospect Identified') {
    items.push({
      id: `${record.id}-contact`,
      title: 'Initial outreach logged',
      detail: `${record.primaryContact} was contacted and service coverage was confirmed.`,
      owner: record.owner,
      timestamp: record.lastUpdated,
    });
  }

  if (record.stage === 'Approved' || record.stage === 'Activated') {
    items.push({
      id: `${record.id}-approved`,
      title: 'Partner approved',
      detail: 'Commercial and compliance review completed. Record is ready for activation.',
      owner: record.reviewer,
      timestamp: record.lastUpdated,
    });
  }

  if (record.stage === 'Activated') {
    items.push({
      id: `${record.id}-activated`,
      title: 'Approved & activated',
      detail: 'Business was promoted into the directory as a live Agent/NP.',
      owner: record.reviewer,
      timestamp: record.lastUpdated,
    });
  }

  if (record.stage === 'Rejected / Archived') {
    items.push({
      id: `${record.id}-archived`,
      title: 'Prospect archived',
      detail: 'Business was archived after fit/compliance review.',
      owner: record.reviewer,
      timestamp: record.lastUpdated,
    });
  }

  return items;
}
