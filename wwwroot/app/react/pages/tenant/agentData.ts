import type { Agent, AgentStatus, BusinessComplianceDocument, BusinessComplianceRequirement, TenantCourier } from '@/types';

export interface ExtAgent extends Agent {
  npDocs?: BusinessComplianceDocument[];
  onboardingRecordId?: number;
  leadSource?: string;
  otdRate?: number;
  clientsServiced?: string[];
  approvedPrograms?: string[];
}

export const NP_DOC_REQUIREMENTS: BusinessComplianceRequirement[] = [
  { id: 1, key: 'business_registration', name: 'Business Registration', description: 'Company registration / incorporation certificate', mandatory: true },
  { id: 2, key: 'insurance', name: 'Proof of Insurance', description: 'General liability & commercial vehicle insurance', mandatory: true },
  { id: 3, key: 'workers_comp', name: 'Workers Compensation Certificate', description: 'Current workers comp certificate of currency', mandatory: true },
  { id: 4, key: 'operating_authority', name: 'Operating Authority', description: 'DOT / MC number or state operating authority', mandatory: true },
  { id: 5, key: 'service_agreement', name: 'Service Agreement', description: 'Signed NP service agreement with tenant', mandatory: true },
  { id: 6, key: 'tax_id', name: 'W-9 / Tax ID', description: 'Tax identification for payment processing', mandatory: true },
  { id: 7, key: 'references', name: 'References', description: 'Business references from existing clients', mandatory: false },
  { id: 8, key: 'fleet_inventory', name: 'Fleet Inventory', description: 'List of vehicles available for service', mandatory: false },
  // Educational / Training Certifications
  { id: 9, key: 'hipaa', name: 'HIPAA Certification', description: 'Health Insurance Portability and Accountability Act training certificate', mandatory: true },
  { id: 10, key: 'bbp', name: 'BBP (Bloodborne Pathogens)', description: 'Bloodborne Pathogens exposure control training certificate', mandatory: true },
  { id: 11, key: 'fwa', name: 'FWA (Fraud Waste Abuse)', description: 'Fraud, Waste, and Abuse compliance training certificate', mandatory: true },
  { id: 12, key: 'tsa', name: 'TSA Certification', description: 'Transportation Security Administration compliance training', mandatory: false },
  { id: 13, key: 'arup', name: 'ARUP Certification', description: 'ARUP Laboratories specimen handling and transport training', mandatory: false },
  { id: 14, key: 'marken', name: 'Marken Certification', description: 'Marken clinical trial logistics and handling training', mandatory: false },
];

export const mockAgents: ExtAgent[] = [
  { id: 1, name: 'Metro Express Couriers', contactName: 'John Smith', phone: '+1 312-555-0101', email: 'john@metroexpress.com', address: '200 N Michigan Ave', city: 'Chicago', state: 'IL', postCode: '60601', country: 'US', gps: null, status: 'Active', ranking: 5, notes: 'Reliable partner, consistently high performance.', association: 'ECA', associationMemberId: 'ECA-1234', isNetworkPartner: true, npTier: 'Multi-Client', npActivatedDate: '2024-06-01', coverageAreas: ['Chicago', 'Northland'], defaultCourierPayPercent: 65, createdDate: '2024-01-15', updatedDate: '2024-12-01', leadSource: 'CLDA Directory', otdRate: 97.8, clientsServiced: ['Marken', 'ARUP', 'STA'], approvedPrograms: ['Marken Bio-Pharma', 'ARUP Labs', 'STA Same-Day'] },
  { id: 2, name: 'Lone Star Logistics', contactName: 'Sarah Chen', phone: '+1 214-555-0202', email: 'sarah@lonestarlogi.com', address: '1200 Main St', city: 'Dallas', state: 'TX', postCode: '75201', country: 'US', gps: null, status: 'Active', ranking: 4, notes: '', association: 'CLDA', associationMemberId: 'CLDA-5678', isNetworkPartner: true, npTier: 'Base', npActivatedDate: '2024-09-15', coverageAreas: ['Dallas'], defaultCourierPayPercent: 60, createdDate: '2024-03-20', updatedDate: '2024-11-28', leadSource: 'Referral', otdRate: 91.5, clientsServiced: ['ARUP', 'Quest Diagnostics'], approvedPrograms: ['ARUP Labs', 'Quest Specimen Transport'] },
  { id: 3, name: 'Capital City Express', contactName: 'Mike Brown', phone: '+1 404-555-0303', email: 'mike@capitalcity.com', address: '100 Peachtree St NW', city: 'Dallas', state: 'TX', postCode: '75201', country: 'US', gps: null, status: 'Active', ranking: 3, notes: '', association: 'ECA', associationMemberId: 'ECA-9012', isNetworkPartner: false, npTier: null, npActivatedDate: null, coverageAreas: [], defaultCourierPayPercent: null, createdDate: '2024-05-10', updatedDate: '2024-10-15', leadSource: 'Website', otdRate: 84.3, clientsServiced: ['STA'], approvedPrograms: ['STA Same-Day'] },
  {
    id: 4, name: 'Sunbelt Express', contactName: 'Lisa Wang', phone: '+1 602-555-0404', email: 'lisa@sunbeltexpress.com', address: '3030 N Central Ave', city: 'Phoenix', state: 'AZ', postCode: '85012', country: 'US', gps: null, status: 'Pending NP', ranking: 0, notes: 'Interested in becoming NP for Phoenix area', association: 'CLDA', associationMemberId: 'CLDA-3456', isNetworkPartner: false, npTier: null, npActivatedDate: null, coverageAreas: [], defaultCourierPayPercent: null, createdDate: '2024-12-01', updatedDate: '2024-12-01', leadSource: 'Inbound Call', otdRate: 78.6, clientsServiced: [], approvedPrograms: [],
    npDocs: [
      { requirementId: 1, status: 'approved', uploadedDate: '2025-01-10', reviewedDate: '2025-01-12' },
      { requirementId: 2, status: 'approved', uploadedDate: '2025-01-10', reviewedDate: '2025-01-12' },
      { requirementId: 3, status: 'under_review', uploadedDate: '2025-02-01' },
      { requirementId: 4, status: 'uploaded', uploadedDate: '2025-02-15' },
      { requirementId: 5, status: 'missing' },
      { requirementId: 6, status: 'approved', uploadedDate: '2025-01-10', reviewedDate: '2025-01-11' },
      { requirementId: 7, status: 'missing' },
      { requirementId: 8, status: 'missing' },
      { requirementId: 9, status: 'approved', uploadedDate: '2025-01-15', reviewedDate: '2025-01-16' },
      { requirementId: 10, status: 'missing' },
      { requirementId: 11, status: 'uploaded', uploadedDate: '2025-02-20' },
      { requirementId: 12, status: 'missing' },
      { requirementId: 13, status: 'missing' },
      { requirementId: 14, status: 'missing' },
    ],
  },
  { id: 5, name: 'Mile High Delivery', contactName: 'Tom Davis', phone: '+1 720-555-0505', email: 'tom@milehighdelivery.com', address: '1600 Broadway', city: 'Denver', state: 'CO', postCode: '80202', country: 'US', gps: null, status: 'Potential', ranking: 2, notes: 'Met at CLDA conference', association: 'None', associationMemberId: '', isNetworkPartner: false, npTier: null, npActivatedDate: null, coverageAreas: [], defaultCourierPayPercent: null, createdDate: '2023-11-05', updatedDate: '2024-08-20', leadSource: 'CLDA Directory', otdRate: 82.1, clientsServiced: [], approvedPrograms: [] },
  { id: 6, name: 'Harbor Freight Express', contactName: 'Alex Tan', phone: '+1 713-555-0606', email: 'alex@harborfreight.com', address: '800 Bagby St', city: 'Houston', state: 'TX', postCode: '77002', country: 'US', gps: null, status: 'Active', ranking: 4, notes: '', association: 'ECA', associationMemberId: 'ECA-2345', isNetworkPartner: true, npTier: 'Multi-Client', npActivatedDate: '2024-04-01', coverageAreas: ['Houston', 'San Antonio'], defaultCourierPayPercent: 62, createdDate: '2024-02-10', updatedDate: '2024-12-10', leadSource: 'Referral', otdRate: 95.4, clientsServiced: ['Marken', 'Quest Diagnostics', 'BioReference'], approvedPrograms: ['Marken Bio-Pharma', 'Quest Specimen Transport', 'BioReference Logistics'] },
  {
    id: 7, name: 'Rocky Mountain Runners', contactName: 'Dave Kowalski', phone: '+1 303-555-0707', email: 'dave@rmrunners.com', address: '1700 Lincoln St', city: 'Denver', state: 'CO', postCode: '80203', country: 'US', gps: null, status: 'Pending NP', ranking: 0, notes: 'Referred by Harbor Freight', association: 'ECA', associationMemberId: 'ECA-7890', isNetworkPartner: false, npTier: null, npActivatedDate: null, coverageAreas: [], defaultCourierPayPercent: null, createdDate: '2025-01-15', updatedDate: '2025-02-20', leadSource: 'Referral', otdRate: 88.9, clientsServiced: ['STA'], approvedPrograms: ['STA Same-Day'],
    npDocs: [
      { requirementId: 1, status: 'approved', uploadedDate: '2025-01-20', reviewedDate: '2025-01-22' },
      { requirementId: 2, status: 'approved', uploadedDate: '2025-01-20', reviewedDate: '2025-01-22' },
      { requirementId: 3, status: 'approved', uploadedDate: '2025-01-20', reviewedDate: '2025-01-25' },
      { requirementId: 4, status: 'approved', uploadedDate: '2025-01-20', reviewedDate: '2025-01-25' },
      { requirementId: 5, status: 'approved', uploadedDate: '2025-02-01', reviewedDate: '2025-02-05' },
      { requirementId: 6, status: 'approved', uploadedDate: '2025-01-20', reviewedDate: '2025-01-22' },
      { requirementId: 7, status: 'uploaded', uploadedDate: '2025-02-15' },
      { requirementId: 8, status: 'approved', uploadedDate: '2025-02-10', reviewedDate: '2025-02-12' },
      { requirementId: 9, status: 'approved', uploadedDate: '2025-02-01', reviewedDate: '2025-02-03' },
      { requirementId: 10, status: 'approved', uploadedDate: '2025-02-01', reviewedDate: '2025-02-03' },
      { requirementId: 11, status: 'approved', uploadedDate: '2025-02-01', reviewedDate: '2025-02-03' },
      { requirementId: 12, status: 'uploaded', uploadedDate: '2025-02-18' },
      { requirementId: 13, status: 'approved', uploadedDate: '2025-02-05', reviewedDate: '2025-02-06' },
      { requirementId: 14, status: 'missing' },
    ],
  },
];

export const mockAgentDrivers: Record<number, TenantCourier[]> = {
  1: [
    { id: 1, agentId: 1, firstName: 'David', lastName: 'Lee', phone: '+1 312-555-7001', email: 'david@metroexpress.com', vehicleType: 'Small', vehicleMake: 'Toyota', vehicleModel: 'Corolla', vehicleRego: 'ABC123', complianceStatus: 'Compliant', gps: { latitude: 41.88, longitude: -87.63 }, isOnline: true, lastActiveDate: '2024-12-15T10:30:00' },
    { id: 2, agentId: 1, firstName: 'Emma', lastName: 'Wilson', phone: '+1 312-555-7002', email: 'emma@metroexpress.com', vehicleType: 'Bike', vehicleMake: 'Honda', vehicleModel: 'CB500', vehicleRego: 'BIK001', complianceStatus: 'Expiring', gps: { latitude: 41.89, longitude: -87.62 }, isOnline: true, lastActiveDate: '2024-12-15T10:25:00' },
    { id: 3, agentId: 1, firstName: 'James', lastName: 'Taylor', phone: '+1 312-555-7003', email: 'james@metroexpress.com', vehicleType: 'Van', vehicleMake: 'Ford', vehicleModel: 'Transit', vehicleRego: 'VAN456', complianceStatus: 'Compliant', gps: null, isOnline: false, lastActiveDate: '2024-12-14T16:00:00' },
  ],
  2: [
    { id: 4, agentId: 2, firstName: 'Nina', lastName: 'Patel', phone: '+1 214-555-7201', email: 'nina@lonestarlogi.com', vehicleType: 'Small', vehicleMake: 'Hyundai', vehicleModel: 'Elantra', vehicleRego: 'TX-204', complianceStatus: 'Compliant', gps: null, isOnline: true, lastActiveDate: '2024-12-15T11:10:00' },
    { id: 5, agentId: 2, firstName: 'Oscar', lastName: 'Diaz', phone: '+1 214-555-7202', email: 'oscar@lonestarlogi.com', vehicleType: 'Van', vehicleMake: 'Ram', vehicleModel: 'ProMaster', vehicleRego: 'TX-778', complianceStatus: 'Non-Compliant', gps: null, isOnline: false, lastActiveDate: '2024-12-10T09:00:00' },
  ],
  4: [
    { id: 6, agentId: 4, firstName: 'Keisha', lastName: 'Brooks', phone: '+1 602-555-7301', email: 'keisha@sunbeltexpress.com', vehicleType: 'Small', vehicleMake: 'Kia', vehicleModel: 'Soul', vehicleRego: 'AZ-111', complianceStatus: 'Expiring', gps: null, isOnline: true, lastActiveDate: '2025-02-18T13:00:00' },
    { id: 7, agentId: 4, firstName: 'Ramon', lastName: 'Lopez', phone: '+1 602-555-7302', email: 'ramon@sunbeltexpress.com', vehicleType: 'Van', vehicleMake: 'Mercedes', vehicleModel: 'Sprinter', vehicleRego: 'AZ-222', complianceStatus: 'Compliant', gps: null, isOnline: false, lastActiveDate: '2025-02-17T08:45:00' },
  ],
  7: [
    { id: 8, agentId: 7, firstName: 'Taylor', lastName: 'Nguyen', phone: '+1 303-555-7401', email: 'taylor@rmrunners.com', vehicleType: 'Bike', vehicleMake: 'Trek', vehicleModel: 'Domane', vehicleRego: 'N/A', complianceStatus: 'Compliant', gps: null, isOnline: true, lastActiveDate: '2025-02-20T12:15:00' },
    { id: 9, agentId: 7, firstName: 'Mark', lastName: 'Fisher', phone: '+1 303-555-7402', email: 'mark@rmrunners.com', vehicleType: 'Truck', vehicleMake: 'Isuzu', vehicleModel: 'NPR', vehicleRego: 'CO-903', complianceStatus: 'Expiring', gps: null, isOnline: false, lastActiveDate: '2025-02-19T17:30:00' },
  ],
};

export function getAgentById(id: number): ExtAgent | undefined {
  return mockAgents.find((agent) => agent.id === id);
}

export function getDriversForAgent(id: number): TenantCourier[] {
  return mockAgentDrivers[id] || [];
}

export function getAgentStatusTone(status: AgentStatus): string {
  const styles: Record<AgentStatus, string> = {
    Active: 'bg-green-100 text-green-700',
    Inactive: 'bg-gray-100 text-gray-600',
    Pending: 'bg-amber-100 text-amber-700',
    Potential: 'bg-blue-100 text-blue-700',
    'Pending NP': 'bg-purple-100 text-purple-700',
    Suspended: 'bg-red-100 text-red-700',
    Archived: 'bg-slate-200 text-slate-500',
  };

  return styles[status];
}
