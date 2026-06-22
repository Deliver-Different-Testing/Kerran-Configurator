import courierApi from './courier_api';

// Courier Portal (finish-line P0) — courier self-service documents. The
// required-docs checklist for the authenticated courier: every courier-
// applicable document type is a row, Missing until uploaded, then Pending →
// Verified/Rejected as staff review it. Same unified document store as the
// applicant flow and the staff NP/Tenant surfaces.

export interface CourierDocumentItem {
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

export const courierDocumentsService = {
  list: () => courierApi.get<CourierDocumentItem[]>('/documents').then(r => r.data),

  upload: (documentTypeId: number, file: File) => {
    const form = new FormData();
    form.append('File', file);
    form.append('DocumentTypeId', String(documentTypeId));
    // Let axios set the multipart boundary; the interceptor still adds
    // X-Portal-Token + X-Requested-With.
    return courierApi
      .post<CourierDocumentItem[]>('/documents', form, { headers: { 'Content-Type': 'multipart/form-data' } })
      .then(r => r.data);
  },

  downloadUrl: (id: number) => `/api/v1/courier/documents/${id}/download?inline=true`,
};
