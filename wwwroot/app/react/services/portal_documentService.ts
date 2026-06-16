import applicantApi from './applicant_api';

// Courier Portal P3 (Slice B) — applicant self-service documents.

export interface PortalDocumentItem {
  documentTypeId: number;
  documentTypeName: string;
  instructions: string | null;
  mandatory: boolean;
  hasExpiry: boolean;
  status: string;                 // Missing | Pending | Verified | Rejected
  documentId: number | null;
  fileName: string | null;
  uploadedDate: string | null;
  expiryDate: string | null;
  rejectReason: string | null;
}

export const portalDocumentService = {
  list: () => applicantApi.get<PortalDocumentItem[]>('/applicants/documents').then(r => r.data),

  upload: (documentTypeId: number, file: File) => {
    const form = new FormData();
    form.append('File', file);
    form.append('DocumentTypeId', String(documentTypeId));
    // Let axios set the multipart boundary; the interceptor still adds
    // X-Portal-Token + X-Requested-With.
    return applicantApi
      .post<PortalDocumentItem[]>('/applicants/documents', form, { headers: { 'Content-Type': 'multipart/form-data' } })
      .then(r => r.data);
  },

  downloadUrl: (id: number) => `/api/portal/applicants/documents/${id}/download`,
};
