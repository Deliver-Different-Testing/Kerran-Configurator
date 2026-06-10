// Document Types — live, backed by /api/v1/np/document-types (migration 030).
// courierDocumentService — live, backed by /api/v1/np/couriers/{id}/documents
// (migration 035 CourierDocuments + S3-backed file storage). The frontend
// CourierDocument type carries AI extraction fields that the backend doesn't
// emit yet; those map to null / false until the AI extraction subsystem
// lands.
import api from './np_api';
import type {
  DocumentType,
  DocumentCategory,
  DocumentAppliesTo,
  DocumentPurpose,
  CourierDocument,
  DocumentStatus,
  DocumentUploadResult,
  DocumentExtractionResult,
} from '@/types';

// Backend shape — NpDocumentTypeDto.
interface DocumentTypeApi {
  id: number;
  name: string;
  instructions: string;
  category: string;
  mandatory: boolean;
  active: boolean;
  hasExpiry: boolean;
  expiryWarningDays: number;
  expiryUrgentDays: number;
  blockOnExpiry: boolean;
  appliesTo: string;
  sortOrder: number;
  purpose: string;
  contentUrl: string;
  estimatedMinutes: number | null;
  quizRequired: boolean;
  hasTemplate: boolean;
  templateFileName: string;
  templateMimeType: string;
  reviewCriteria: string;
  createdDate: string;
  modifiedDate: string | null;
}

function toDocumentType(d: DocumentTypeApi): DocumentType {
  return {
    id: d.id,
    name: d.name,
    instructions: d.instructions || null,
    category: (d.category || 'Other') as DocumentCategory,
    mandatory: d.mandatory,
    active: d.active,
    hasExpiry: d.hasExpiry,
    expiryWarningDays: d.expiryWarningDays,
    expiryUrgentDays: d.expiryUrgentDays,
    blockOnExpiry: d.blockOnExpiry,
    appliesTo: (d.appliesTo || 'Both') as DocumentAppliesTo,
    sortOrder: d.sortOrder,
    purpose: (d.purpose || 'Compliance') as DocumentPurpose,
    contentUrl: d.contentUrl || undefined,
    estimatedMinutes: d.estimatedMinutes ?? undefined,
    quizRequired: d.quizRequired,
    hasTemplate: d.hasTemplate,
    templateFileName: d.templateFileName || null,
    templateMimeType: d.templateMimeType || null,
    reviewCriteria: d.reviewCriteria || undefined,
    createdDate: d.createdDate,
    modifiedDate: d.modifiedDate ?? null,
  };
}

// Partial<DocumentType> → NpDocumentTypeUpsertDto. Template metadata is owned
// by the (not-yet-wired) template-upload flow, so it isn't sent here.
function toUpsert(p: Partial<DocumentType>) {
  return {
    name: p.name ?? '',
    instructions: p.instructions ?? '',
    category: p.category ?? 'Other',
    mandatory: !!p.mandatory,
    active: p.active ?? true,
    hasExpiry: !!p.hasExpiry,
    expiryWarningDays: p.expiryWarningDays ?? 30,
    expiryUrgentDays: p.expiryUrgentDays ?? 7,
    blockOnExpiry: !!p.blockOnExpiry,
    appliesTo: p.appliesTo ?? 'Both',
    sortOrder: p.sortOrder ?? 0,
    purpose: p.purpose ?? 'Compliance',
    contentUrl: p.contentUrl ?? '',
    estimatedMinutes: p.estimatedMinutes ?? null,
    quizRequired: !!p.quizRequired,
    reviewCriteria: p.reviewCriteria ?? '',
  };
}

export const documentTypeService = {
  async getAll(): Promise<DocumentType[]> {
    const { data } = await api.get<DocumentTypeApi[]>('/document-types');
    return (data ?? []).map(toDocumentType);
  },

  async getById(id: number): Promise<DocumentType | undefined> {
    const all = await documentTypeService.getAll();
    return all.find(d => d.id === id);
  },

  async create(dto: Partial<DocumentType>): Promise<DocumentType> {
    const { data } = await api.post<DocumentTypeApi>('/document-types', toUpsert(dto));
    return toDocumentType(data);
  },

  async update(id: number, dto: Partial<DocumentType>): Promise<DocumentType> {
    const { data } = await api.put<DocumentTypeApi>(`/document-types/${id}`, toUpsert(dto));
    return toDocumentType(data);
  },

  // Soft delete — the backend flips IsActive to false.
  async deactivate(id: number): Promise<void> {
    await api.delete(`/document-types/${id}`);
  },

  // No default-set seeding endpoint — document types are created manually.
  // Kept so the existing "Seed" button resolves harmlessly (just re-reads).
  async seed(): Promise<DocumentType[]> {
    return documentTypeService.getAll();
  },

  // Templates — blank forms attached to a DocumentType, stored in S3 under the
  // same compliance-uploads bucket as courier-document instances but with key
  // prefix `tenant-{id}/templates/doctype-{id}/{uuid}.{ext}`. Proxy-download
  // via the API so cookie auth + audit are end-to-end (mirrors the courier-doc
  // download model — no presigned URLs).

  async uploadTemplate(id: number, file: File): Promise<DocumentType> {
    const form = new FormData();
    form.append('File', file);
    const { data } = await api.post<DocumentTypeApi>(
      `/document-types/${id}/template`,
      form,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
    return toDocumentType(data);
  },

  // Returns the proxy-download URL. Caller opens in a new tab; the browser
  // streams from the API which streams from S3. Returned async to mirror the
  // courierDocumentService shape.
  async downloadTemplate(id: number): Promise<string> {
    return `/api/v1/np/document-types/${id}/template`;
  },

  async removeTemplate(id: number): Promise<DocumentType> {
    const { data } = await api.delete<DocumentTypeApi>(`/document-types/${id}/template`);
    return toDocumentType(data);
  },
};

// ─── courier document instances (live) ───────────────────────────────────

// Backend shape — NpCourierDocumentDto. Differences from the frontend
// CourierDocument type:
//   - mimeType    ← contentType
//   - fileSize    ← length
//   - notes       ← rejectReason
//   - status      ← derived from verifyStatus + expiryDate (see deriveStatus)
//   - aiConfidence / aiDetectedType / aiVerified — null / null / false
//     (AI extraction is not yet wired; the backend doesn't emit these)
//   - humanVerified ← verifyStatus === 'Verified'
interface CourierDocumentApi {
  id: number;
  courierId: number;
  documentTypeId: number;
  documentTypeName: string;
  fileName: string;
  contentType: string;
  length: number;
  uploadedDate: string;
  uploadedBy: string;
  verifyStatus: string;  // 'Pending' | 'Verified' | 'Rejected'
  verifiedDate: string | null;
  verifiedBy: string;
  rejectReason: string;
  expiryDate: string | null;  // ISO date 'YYYY-MM-DD' (DateOnly on the wire)
  isActive: boolean;
}

const EXPIRY_WARNING_DAYS_DEFAULT = 30;

function deriveStatus(expiry: string | null): DocumentStatus {
  if (!expiry) return 'Current';
  const expiryMs = new Date(expiry).getTime();
  if (Number.isNaN(expiryMs)) return 'Current';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.floor((expiryMs - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return 'Expired';
  if (diffDays <= EXPIRY_WARNING_DAYS_DEFAULT) return 'ExpiringSoon';
  return 'Current';
}

function toCourierDocument(d: CourierDocumentApi): CourierDocument {
  return {
    id: d.id,
    courierId: d.courierId,
    documentTypeId: d.documentTypeId,
    documentTypeName: d.documentTypeName,
    category: 'Other' as DocumentCategory,  // category lives on DocumentType; not duplicated on the doc instance
    fileName: d.fileName,
    mimeType: d.contentType,
    fileSize: d.length,
    expiryDate: d.expiryDate,
    status: deriveStatus(d.expiryDate),
    aiConfidence: null,
    aiDetectedType: null,
    aiVerified: false,
    humanVerified: d.verifyStatus === 'Verified',
    uploadedDate: d.uploadedDate,
    uploadedBy: d.uploadedBy || null,
    verifiedDate: d.verifiedDate,
    verifiedBy: d.verifiedBy || null,
    notes: d.rejectReason || null,
  };
}

// Mark older documents of the same type as Superseded so the existing
// useComplianceSummary / per-type lookups in CourierSetup find the "active"
// one cleanly. Server orders by UploadedDate desc, so the first occurrence
// of each documentTypeId is the live one; the rest are superseded.
function applySupersededFlag(docs: CourierDocument[]): CourierDocument[] {
  const seen = new Set<number>();
  return docs.map(doc => {
    if (seen.has(doc.documentTypeId)) {
      return { ...doc, status: 'Superseded' as const };
    }
    seen.add(doc.documentTypeId);
    return doc;
  });
}

export const courierDocumentService = {
  async getDocuments(courierId: number): Promise<CourierDocument[]> {
    const { data } = await api.get<CourierDocumentApi[]>(`/couriers/${courierId}/documents`);
    const mapped = (data ?? []).filter(d => d.verifyStatus !== 'Rejected').map(toCourierDocument);
    return applySupersededFlag(mapped);
  },

  async upload(courierId: number, documentTypeId: number, file: File): Promise<DocumentUploadResult> {
    const form = new FormData();
    form.append('File', file);
    form.append('DocumentTypeId', String(documentTypeId));
    // ExpiryDate is not collected by the current upload UI; left null so
    // the backend stores it as NULL. Adding an expiry input belongs with
    // a DocumentType.hasExpiry-aware upload flow (deferred).

    const { data } = await api.post<CourierDocumentApi>(
      `/couriers/${courierId}/documents`,
      form,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );

    const doc = toCourierDocument(data);
    return {
      documentId: doc.id,
      fileName: doc.fileName,
      status: doc.status,
      extraction: null,  // AI extraction not yet wired
    };
  },

  // Returns a direct URL to the proxy-download endpoint. Browser fetches
  // bytes via cookie auth; backend streams from S3. No presigned URL.
  // Returned async to match the existing hook signature.
  async getDownloadUrl(courierId: number, docId: number): Promise<string> {
    return `/api/v1/np/couriers/${courierId}/documents/${docId}/download`;
  },

  async delete(courierId: number, docId: number): Promise<void> {
    await api.delete(`/couriers/${courierId}/documents/${docId}`);
  },

  async verify(courierId: number, docId: number): Promise<CourierDocument> {
    const { data } = await api.put<CourierDocumentApi>(`/couriers/${courierId}/documents/${docId}/verify`);
    return toCourierDocument(data);
  },

  async reject(courierId: number, docId: number, reason: string): Promise<CourierDocument> {
    const { data } = await api.put<CourierDocumentApi>(
      `/couriers/${courierId}/documents/${docId}/reject`,
      { reason }
    );
    return toCourierDocument(data);
  },

  // AI extraction is a separate subsystem not yet wired. Left as a throwing
  // stub so the existing ScanToFill / upload-flow code paths that branch
  // on extraction remain detectable rather than silently degrading.
  extractOnly(_courierId: number, _file: File): DocumentExtractionResult {
    throw new Error('extractOnly() not yet wired to backend');
  },
};
