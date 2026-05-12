import { useState, useEffect, useCallback } from 'react';
import { documentTypeService, courierDocumentService } from '@/services/np_documentService';
import type {
  DocumentType,
  CourierDocument,
  DocumentUploadResult,
  DocumentStatus,
} from '@/types';

export interface ComplianceSummary {
  total: number;
  current: number;
  expiring: number;
  expired: number;
  missing: number;
}

export function useDocumentTypes() {
  const [types, setTypes] = useState<DocumentType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await documentTypeService.getAll();
      setTypes(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load document types');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { types, loading, error, refresh };
}

export function useCourierDocuments(courierId: number | null) {
  const [documents, setDocuments] = useState<CourierDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!courierId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await courierDocumentService.getDocuments(courierId);
      setDocuments(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load documents');
    } finally {
      setLoading(false);
    }
  }, [courierId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const upload = useCallback(
    async (documentTypeId: number, file: File): Promise<DocumentUploadResult | null> => {
      if (!courierId) return null;
      try {
        const result = await courierDocumentService.upload(courierId, documentTypeId, file);
        await refresh();
        return result;
      } catch (err: any) {
        setError(err.message || 'Upload failed');
        return null;
      }
    },
    [courierId, refresh]
  );

  const deleteDoc = useCallback(
    async (docId: number) => {
      if (!courierId) return;
      try {
        await courierDocumentService.delete(courierId, docId);
        await refresh();
      } catch (err: any) {
        setError(err.message || 'Delete failed');
      }
    },
    [courierId, refresh]
  );

  const verify = useCallback(
    async (docId: number) => {
      if (!courierId) return;
      try {
        await courierDocumentService.verify(courierId, docId);
        await refresh();
      } catch (err: any) {
        setError(err.message || 'Verification failed');
      }
    },
    [courierId, refresh]
  );

  const getDownloadUrl = useCallback(
    async (docId: number): Promise<string | null> => {
      if (!courierId) return null;
      try {
        return await courierDocumentService.getDownloadUrl(courierId, docId);
      } catch {
        return null;
      }
    },
    [courierId]
  );

  return { documents, loading, error, refresh, upload, deleteDoc, verify, getDownloadUrl };
}

export function useComplianceSummary(
  documentTypes: DocumentType[],
  documents: CourierDocument[]
): ComplianceSummary {
  const mandatoryTypes = documentTypes.filter((dt) => dt.mandatory && dt.active);
  const total = mandatoryTypes.length;

  let current = 0;
  let expiring = 0;
  let expired = 0;
  let missing = 0;

  for (const dt of mandatoryTypes) {
    const doc = documents.find(
      (d) => d.documentTypeId === dt.id && d.status !== 'Superseded'
    );
    if (!doc) {
      missing++;
    } else if (doc.status === 'Current') {
      current++;
    } else if (doc.status === 'ExpiringSoon') {
      expiring++;
    } else if (doc.status === 'Expired') {
      expired++;
    }
  }

  return { total, current, expiring, expired, missing };
}
