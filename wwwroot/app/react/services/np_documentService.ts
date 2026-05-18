// Document Types — live, backed by /api/v1/np/document-types (migration 030).
// courierDocumentService (courier document *instances*) stays a stub — there
// is no courier-document table yet.
import api from './np_api';
import type {
  DocumentType,
  DocumentCategory,
  DocumentAppliesTo,
  DocumentPurpose,
  CourierDocument,
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
    blockOnExpiry: !!p.blockOnExpiry,
    appliesTo: p.appliesTo ?? 'Both',
    sortOrder: p.sortOrder ?? 0,
    purpose: p.purpose ?? 'Compliance',
    contentUrl: p.contentUrl ?? '',
    estimatedMinutes: p.estimatedMinutes ?? null,
    quizRequired: !!p.quizRequired,
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

  // Template files belong in S3 — upload/download is a separate sub-feature
  // not yet wired. The HasTemplate/TemplateS3Key columns exist for it.
  downloadTemplate(_id: number): never {
    throw new Error('Template download not yet wired to backend');
  },
  uploadTemplate(_id: number, _file: File): never {
    throw new Error('Template upload not yet wired to backend');
  },
};

export const courierDocumentService = {
  getDocuments(_courierId: number): CourierDocument[] {
    return [];
  },

  upload(_courierId: number, _documentTypeId: number, _file: File): DocumentUploadResult {
    throw new Error('upload() not yet wired to backend');
  },

  getDownloadUrl(_courierId: number, _docId: number): string {
    return '#';
  },

  delete(_courierId: number, _docId: number): void {
    /* no-op stub */
  },

  verify(_courierId: number, _docId: number): CourierDocument {
    throw new Error('verify() not yet wired to backend');
  },

  extractOnly(_courierId: number, _file: File): DocumentExtractionResult {
    throw new Error('extractOnly() not yet wired to backend');
  },
};
