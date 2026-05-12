// Phase 3 stub: see np_dashboardService.ts for the conversion pattern.
import type {
  DocumentType,
  CourierDocument,
  DocumentUploadResult,
  DocumentExtractionResult,
} from '@/types';

export const documentTypeService = {
  getAll(): DocumentType[] {
    return [];
  },

  getById(_id: number): DocumentType | undefined {
    return undefined;
  },

  create(_dto: Partial<DocumentType>): DocumentType {
    throw new Error('create() not yet wired to backend');
  },

  update(_id: number, _dto: Partial<DocumentType>): DocumentType {
    throw new Error('update() not yet wired to backend');
  },

  deactivate(_id: number): void {
    /* no-op stub */
  },

  downloadTemplate(_id: number): Blob {
    throw new Error('downloadTemplate() not yet wired to backend');
  },

  uploadTemplate(_id: number, _file: File): { s3Key: string; fileName: string } {
    throw new Error('uploadTemplate() not yet wired to backend');
  },

  seed(): DocumentType[] {
    return [];
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
