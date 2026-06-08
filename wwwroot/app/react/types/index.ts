// ══════════════════════════════════════════════
// NP Portal Types
// ══════════════════════════════════════════════

export interface Courier {
  id: number;
  code: string;
  firstName: string;
  surName: string;
  // Commercial relationship (tucCourier.CourierTypeId 1/2/3/4). Independent =
  // no master, no subs; Master has subs; Sub works under a master; Gig is
  // Openforce-aggregation paid. `master` is set only for Sub.
  type: 'Independent' | 'Master' | 'Sub' | 'Gig';
  master: number | null;
  // NP assignment (NP-COLUMN-AND-COURIER-DETAIL). npAgentId null = "Direct"
  // (belongs to the tenant, not under an NP). npAgentName is the display label.
  npAgentId?: number | null;
  npAgentName?: string;
  // Payment / invoice channel (Kerran): 'Direct' | 'Invoice' | 'None'.
  paymentMethod?: string;
  gender: string;
  dob: string;
  startDate: string;
  finishDate: string;
  phone: string;
  urgentMobile: string;
  email: string;
  homePhone: string;
  address: string;
  doctor: string;
  doctorPhone: string;
  nextOfKin: string;
  nokRelationship: string;
  nokAddress: string;
  nokPhone: string;
  vehicle: string;
  make: string;
  makeId?: number | null;
  model: string;
  year: number;
  rego: string;
  lowEmission: boolean;
  maxPallets: number;
  tareWeight: number;
  maxCarry: number;
  rucWeight: number;
  rucKms: number;
  rucPayload: number;
  height: number;
  width: number;
  length: number;
  inspectionExpiry: string;
  regoExpiry: string;
  dlNo: string;
  dlExpiry: string;
  dangerousGoods: boolean;
  dgExpiry: string;
  hte: boolean;
  tslNo: string;
  policyNo: string;
  insuranceCo: string;
  insuranceCoId?: number | null;
  carrierLiab: number;
  publicLiab: number;
  carrierLiabCompany?: string;
  carrierLiabId?: number | null;
  publicLiabCompany?: string;
  publicLiabId?: number | null;
  commercialIns: boolean;
  taxId: string;
  wht: number;
  bankAcct: string;
  payPct: number;
  bonusPct: number;
  paydayReg: boolean;
  contractSigned: string;
  securityCheck: string;
  channel: string;
  deviceType: string;
  deviceAdmin: boolean;
  vodafone: boolean;
  smsJob: boolean;
  smsAlert: boolean;
  webEnabled: boolean;
  autoDispatch: boolean;
  showClientPhone: boolean;
  mobileAdvert: boolean;
  displayWeb: boolean;
  password: string;
  podRequired: boolean;
  startTime: string;
  endTime: string;
  status: 'active' | 'inactive';
  location: string;
  lastActive: string;
  compliance: 'ok' | 'warning' | 'expired';
  tenantApprovalStatus?: 'not_submitted' | 'pending_approval' | 'approved' | 'rejected';
  tenantApprovalDate?: string;
  tenantApprovalNotes?: string;
  complianceProfileId?: number;
  notes: string;
  created: string;
  createdBy: string;
  modified: string;
  modifiedBy: string;
  trainingInit: number;
  trainingFollow: number;
  documents: CourierDocumentLegacy[];
  /** Whether a mobile-app login exists. false = none (flagged in UI); null/undefined = unknown. */
  hasMobileLogin?: boolean | null;
}

/** Legacy shape used by mock data — will be removed when mock data is replaced by API */
export interface CourierDocumentLegacy {
  type: string;
  uploaded: string;
  expiry: string;
  status: 'current' | 'expiring' | 'expired';
}

export interface UserRoleRef {
  id: number;
  name: string;
}

// Unified Permissions §8.1 — Users list row: Client/NP name + stacked role badges.
export interface User {
  id: string;
  name: string;
  email: string;
  clientName: string;
  roles: UserRoleRef[];
  status: 'active' | 'inactive';
  lastLogin: string;
}

export interface DashboardStats {
  activeCouriers: number;
  jobsToday: number;
  completed: number;
  revenueThisWeek: string;
}

export interface ActivityItem {
  time: string;
  description: string;
}

export interface ReportData {
  jobsCompleted: number;
  onTimePercent: number;
  revenue: string;
  dailyVolume: { day: string; value: number }[];
}

export interface CompanySettings {
  name: string;
  code: string;
  address: string;
  phone: string;
  email: string;
  coverageAreas: string[];
  notifications: Record<string, boolean>;
}

export interface NavItem {
  id: string;
  icon: string;
  label: string;
  children?: NavChild[];
  disabled?: boolean;
  locked?: boolean;
}

export interface NavChild {
  id: string;
  label: string;
  ext?: boolean;
}

export interface PortalLink {
  courierId: number;
  code: string;
  name: string;
  url: string;
}

// ══════════════════════════════════════════════
// Tenant Types
// ══════════════════════════════════════════════

export type AgentStatus = 'Active' | 'Inactive' | 'Pending' | 'Suspended' | 'Potential' | 'Pending NP' | 'Archived';
export type AssociationType = 'ECA' | 'CLDA' | 'None';
export type NpTier = 'Base' | 'Multi-Client';
export type BusinessComplianceStatus = 'missing' | 'uploaded' | 'under_review' | 'approved' | 'rejected';

export interface BusinessComplianceRequirement {
  id: number;
  key: string;
  name: string;
  description: string;
  mandatory: boolean;
}

export interface BusinessComplianceDocument {
  requirementId: number;
  status: BusinessComplianceStatus;
  uploadedDate?: string;
  reviewedDate?: string;
  source?: 'directory' | 'onboarding';
  notes?: string;
}

export interface GpsCoords {
  latitude: number;
  longitude: number;
}

export interface Agent {
  id: number;
  name: string;
  contactName: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  state: string;
  postCode: string;
  country: string;
  gps: GpsCoords | null;
  status: AgentStatus;
  ranking: number;
  notes: string;
  association: AssociationType;
  associationMemberId: string;
  isNetworkPartner: boolean;
  npTier: NpTier | null;
  npActivatedDate: string | null;
  coverageAreas: string[];
  // Phase 5+29b §C — surfaces backend's per-city zip-count + resolution
  // flag alongside the name list. Coexists with coverageAreas (names) so
  // existing consumers (AgentWorkspace etc.) keep working unchanged.
  // AgentList chip render uses this to show "Sacramento (42)" + yellow
  // "no zips" badge when hasZipMapping=false.
  coverageAreaDetails?: AgentCoverageAreaDetail[];
  defaultCourierPayPercent: number | null;
  createdDate: string;
  updatedDate: string;
  // Lookup-table IDs surfaced for the Edit Agent modal — read+write via dropdowns.
  statusId?: number;
  rankingId?: number | null;
  npPortalEnabled?: boolean;
  npTierByte?: number;
  // Phase 5+27.1 — linked TucClient.ClientTypeId (1 Internal / 2 Customer /
  // 3 NetworkPartner, or any further seeded value). Null when no TucClient
  // is linked (non-NP agent).
  clientTypeId?: number | null;
  // Optional NP compliance documents — populated for agents with status
  // 'Pending NP' (rendered as a compliance bar in AgentList) and read by
  // AgentWorkspace's inline expansion. May be absent on regular Agent
  // records; consumers default to []. Added 2026-05-27 to silence the
  // type-check that was tolerated by Vite's looser esbuild build but
  // surfaced once CI's tsc --noEmit ran on the MR.
  npDocs?: BusinessComplianceDocument[];
}

// Phase 5+29b §C — per-coverage-area detail for the chip render.
export interface AgentCoverageAreaDetail {
  areaName: string;
  zipCount: number;
  hasZipMapping: boolean;
}

// Phase 5+29b §C — city autocomplete suggestion from
// GET /api/v1/tenant/lookups/cities?q=...
export interface CitySuggestion {
  cityName: string;
  state: string | null;
  zipCount: number;
}

export type VehicleSize = 'Bike' | 'Small' | 'Medium' | 'Large' | 'Van' | 'Truck';

export interface RateCard {
  id: number;
  agentId: number;
  vehicleSize: VehicleSize;
  baseCharge: number;
  distanceIncluded: number;
  perDistanceUnit: number;
  extraCharge: number;
}

export type CourierComplianceStatus = 'Compliant' | 'Expiring' | 'Non-Compliant';

export interface TenantCourier {
  id: number;
  agentId: number;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  vehicleType: VehicleSize;
  vehicleMake: string;
  vehicleModel: string;
  vehicleRego: string;
  complianceStatus: CourierComplianceStatus;
  gps: GpsCoords | null;
  isOnline: boolean;
  lastActiveDate: string;
}

export type PortalRole = 'Admin' | 'Dispatcher' | 'ReadOnly';

export interface NpContact {
  id: number;
  agentId: number;
  name: string;
  email: string;
  phone: string;
  role: PortalRole;
  isActive: boolean;
  lastLoginDate: string | null;
}

export type PostingStatus = 'Open' | 'Quoted' | 'Awarded' | 'Closed';
export type ServiceType = 'Same Day' | 'Next Day' | 'Scheduled' | 'Overnight';
export type QuoteStatus = 'Requested' | 'Submitted' | 'Accepted' | 'Declined' | 'Expired';

export interface QuotesPosting {
  id: number;
  title: string;
  region: string;
  serviceType: ServiceType;
  volumePerWeek: number;
  startDate: string;
  endDate: string;
  status: PostingStatus;
  quoteCount: number;
  createdDate: string;
}

export interface Quote {
  id: number;
  postingId: number;
  agentId: number;
  agentName: string;
  association: AssociationType;
  pricePerJob: number;
  rateType?: string | null;
  availableFleetSize?: number | null;
  leadTime: string;
  coverageAreas: string[];
  notes: string;
  // Lifecycle timestamps — ISO 8601 UTC ("2026-05-13T01:29:00Z") or empty
  // string when that state hasn't been reached. requestedDate is always
  // populated. The frontend buckets these into "today / yesterday / Nd ago"
  // by *local* calendar day.
  requestedDate: string;
  submittedDate: string;
  reviewedDate: string;
  expiredDate: string;
  status: QuoteStatus;
}

export type ChatRole = 'user' | 'assistant';

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  timestamp: string;
  carrierResults?: CarrierSearchResult[];
}

export interface CarrierSearchResult {
  id: number;
  name: string;
  city: string;
  state: string;
  phone: string;
  services: string[];
  certifications: string[];
  association: AssociationType;
  rating: number;
}

export interface TenantDashboardStats {
  totalAgents: number;
  activeNps: number;
  pendingOnboarding: number;
  totalCarriersInRegistry: number;
}

export interface RecentActivity {
  id: number;
  type: 'agent_added' | 'np_activated' | 'quote_received' | 'onboarding_started';
  description: string;
  timestamp: string;
}

export interface AssociationStat {
  association: AssociationType;
  totalCarriers: number;
  onboardedCount: number;
  activeNps: number;
  coverageStates: string[];
}

export interface OnboardingData {
  association: AssociationType;
  memberId: string;
  name: string;
  contactName: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  state: string;
  postCode: string;
  documents: File[];
  fastTrack: boolean;
}

export interface Column<T> {
  key: string;
  header: string;
  sortable?: boolean;
  render?: (row: T) => React.ReactNode;
}

// ══════════════════════════════════════════════
// Document Management Types
// ══════════════════════════════════════════════

export type DocumentCategory = 'Licensing' | 'Insurance' | 'Vehicle' | 'Contract' | 'Other';
export type DocumentAppliesToOption = 'Applicant' | 'ActiveCourier' | 'NP';
/** @deprecated Use appliesToList for multi-select. Legacy 'Both' = ['Applicant','ActiveCourier'] */
export type DocumentAppliesTo = 'Applicant' | 'ActiveCourier' | 'Both' | 'NP' | 'All';
export type DocumentStatus = 'Current' | 'ExpiringSoon' | 'Expired' | 'Superseded';
export type DocumentPurpose = 'Compliance' | 'Training';

export interface DocumentType {
  id: number;
  name: string;
  instructions: string | null;
  category: DocumentCategory;
  mandatory: boolean;
  active: boolean;
  hasExpiry: boolean;
  expiryWarningDays: number;
  blockOnExpiry: boolean;
  appliesTo: DocumentAppliesTo;
  sortOrder: number;
  purpose: DocumentPurpose;
  contentUrl?: string;
  estimatedMinutes?: number;
  quizRequired: boolean;
  hasTemplate: boolean;
  templateFileName?: string | null;
  templateMimeType?: string | null;
  tenantId?: number;
  createdDate?: string;
  modifiedDate?: string | null;
}

export interface CourierDocument {
  id: number;
  courierId: number;
  documentTypeId: number;
  documentTypeName: string;
  category: DocumentCategory;
  fileName: string;
  mimeType: string;
  fileSize: number;
  expiryDate: string | null;
  status: DocumentStatus;
  aiConfidence: number | null;
  aiDetectedType: string | null;
  aiVerified: boolean;
  humanVerified: boolean;
  uploadedDate: string;
  uploadedBy: string | null;
  verifiedDate: string | null;
  verifiedBy: string | null;
  notes: string | null;
}

export interface ExtractedField {
  fieldName: string;
  value: string | null;
  confidence: number;
  rawText: string | null;
}

export interface DocumentExtractionResult {
  detectedDocumentType: string | null;
  overallConfidence: number;
  fields: ExtractedField[];
  detectedExpiryDate: string | null;
  autoAccepted: boolean;
}

export interface DocumentUploadResult {
  documentId: number;
  fileName: string;
  status: DocumentStatus;
  extraction: DocumentExtractionResult | null;
}

// ══════════════════════════════════════════════
// Compliance Dashboard Types
// ══════════════════════════════════════════════

export interface ComplianceDashboard {
  totalActiveCouriers: number;
  totalCompliant: number;
  totalWarnings: number;
  totalNonCompliant: number;
  fleetCompliancePercent: number;
  breakdownByType: ComplianceBreakdownByType[];
  urgentAlerts: ComplianceAlert[];
}

export interface ComplianceBreakdownByType {
  documentTypeId: number;
  documentTypeName: string;
  category: string;
  totalRequired: number;
  current: number;
  expiring: number;
  expired: number;
  missing: number;
}

export interface ComplianceAlert {
  courierId: number;
  courierName: string;
  documentType: string;
  expiryDate: string | null;
  isExpired: boolean;
  alertStatus: 'Expired' | 'Expiring' | 'Missing' | 'Current';
  fleet?: string;
  daysUntilExpiry: number | null;
}

export interface CourierComplianceScore {
  courierId: number;
  courierName: string;
  status: string;
  compliancePercent: number;
  documentStatuses: CourierDocTypeStatus[];
}

export interface CourierDocTypeStatus {
  documentTypeId: number;
  documentTypeName: string;
  category: string;
  mandatory: boolean;
  status: string;
  expiryDate: string | null;
  daysUntilExpiry: number | null;
}

export interface ComplianceAlertFilter {
  docType?: string;
  status?: string;
  courierName?: string;
  daysAhead?: number;
}

// ══════════════════════════════════════════════
// Recruitment Pipeline Types
// ══════════════════════════════════════════════

export type ApplicantPipelineStage =
  | 'Registration'
  | 'Email Verification'
  | 'Profile'
  | 'Documentation'
  | 'Declaration/Contract'
  | 'Training'
  | 'Approval';

export interface CourierApplicant {
  id: number;
  tenantId: number;
  regionId: number | null;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  postcode: string | null;
  vehicleType: string | null;
  vehicleMake: string | null;
  vehicleModel: string | null;
  vehicleYear: number | null;
  vehiclePlate: string | null;
  bankAccountName: string | null;
  bankAccountNumber: string | null;
  bankBSB: string | null;
  nextOfKinName: string | null;
  nextOfKinPhone: string | null;
  nextOfKinRelationship: string | null;
  pipelineStage: ApplicantPipelineStage;
  declarationSigned: boolean;
  declarationSignedDate: string | null;
  declarationSignatureS3Key: string | null;
  rejectedDate: string | null;
  rejectedReason: string | null;
  approvedAsCourierId: number | null;
  createdDate: string;
  modifiedDate: string | null;
  notes: string | null;
  // Documents attached to this applicant
  documents?: ApplicantDocumentSummary[];
}

export interface ApplicantDocumentSummary {
  documentTypeName: string;
  category: string;
  mandatory: boolean;
  status: 'uploaded' | 'verified' | 'rejected' | 'missing' | 'expired';
  fileName?: string;
  uploadedDate?: string;
  expiryDate?: string | null;
  aiConfidence?: number | null;
}

export interface RecruitmentStageConfig {
  id: number;
  tenantId: number;
  stageName: string;
  sortOrder: number;
  enabled: boolean;
  mandatory: boolean;
  description: string | null;
  createdDate: string;
}

export interface CourierContract {
  id: number;
  tenantId: number;
  name: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  uploadedDate: string;
  uploadedBy: string | null;
  isActive: boolean;
  version: number;
  createdDate: string;
}

export interface PipelineSummary {
  stageName: string;
  count: number;
}

export interface ApplicantFilter {
  stage?: string;
  search?: string;
  from?: string;
  to?: string;
}

// ══════════════════════════════════════════════
// Compliance Profile Types
// ══════════════════════════════════════════════

export interface ComplianceProfile {
  id: number;
  name: string;
  description: string;
  isDefault: boolean;
  tenantId: number;
  clientId?: number;
  clientName?: string;
  clientIds?: number[];
  clientNames?: string[];
  requirements: ComplianceRequirement[];
  createdDate: string;
  modifiedDate?: string;
  active: boolean;
}

export interface ComplianceRequirement {
  id: number;
  profileId: number;
  documentTypeId: number;
  documentTypeName: string;
  purpose: DocumentPurpose;
  mandatory: boolean;
  sortOrder: number;
  quizRequired?: boolean;
  quizId?: number;
}

export interface DriverComplianceStatus {
  courierId: number;
  courierName: string;
  profiles: ProfileComplianceStatus[];
  overallCompletionPct: number;
}

export interface ProfileComplianceStatus {
  profileId: number;
  profileName: string;
  isEligible: boolean;
  requirements: RequirementStatus[];
  completionPct: number;
}

export interface RequirementStatus {
  requirementId: number;
  documentTypeId: number;
  documentTypeName: string;
  purpose: DocumentPurpose;
  mandatory: boolean;
  status: 'Complete' | 'Expired' | 'Expiring' | 'Missing';
  completedDate?: string;
  expiryDate?: string;
}

export interface TenantRecruitmentConfig {
  recruitmentViewMode: 'full_pipeline' | 'ready_for_review';
  visibleStages?: string[];
}

// ══════════════════════════════════════════════
// Quiz Types
// ══════════════════════════════════════════════

export interface QuizDefinition {
  id: number;
  documentTypeId: number;
  tenantId: number;
  title: string;
  description: string;
  passMarkPercent: number;
  maxAttempts: number | null;
  randomizeQuestions: boolean;
  randomizeOptions: boolean;
  timeLimitMinutes: number | null;
  active: boolean;
  questions: QuizQuestion[];
  createdDate: string;
  modifiedDate?: string;
}

export interface QuizQuestion {
  id: number;
  quizDefinitionId: number;
  questionText: string;
  questionType: 'multiple_choice' | 'true_false' | 'multi_select';
  explanation?: string;
  sortOrder: number;
  points: number;
  active: boolean;
  options: QuizOption[];
}

export interface QuizOption {
  id: number;
  questionId: number;
  optionText: string;
  isCorrect: boolean;
  sortOrder: number;
}

export interface QuizAttempt {
  id: number;
  quizDefinitionId: number;
  courierId: number;
  courierName?: string;
  startedAt: string;
  completedAt?: string;
  score?: number;
  passed?: boolean;
  totalQuestions: number;
  correctAnswers: number;
  timeTakenSeconds?: number;
  answers: QuizAttemptAnswer[];
}

export interface QuizAttemptAnswer {
  id: number;
  attemptId: number;
  questionId: number;
  selectedOptionIds: number[];
  isCorrect: boolean;
}

// Per-NP feature toggles (Phase 5+26) retired in Phase 5+31 R2 — the
// matrix at /settings/feature-matrix replaces this surface. The dbo.
// NpFeatureConfig table itself is kept; only the 7 gate columns get
// dropped (see dbmigrationsv2 slice D). Non-gate fields (notification
// routing, capacity, coverage) are read directly by the consuming
// services and never had React types here.
