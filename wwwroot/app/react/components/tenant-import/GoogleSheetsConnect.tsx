import React, { useState } from 'react';
import { importService } from '@/services/tenant_importService';

interface GoogleSheetsConnectProps {
  onParsed: (result: { columns: string[]; previewRows: Record<string, string>[]; totalRows: number; allRows: Record<string, string>[] }) => void;
  isLoading?: boolean;
  onLoadingChange?: (loading: boolean) => void;
}

export function GoogleSheetsConnect({ onParsed, isLoading = false, onLoadingChange }: GoogleSheetsConnectProps) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');

  const handleConnect = async () => {
    setError('');
    const fileId = importService.extractGoogleSheetId(url);
    if (!fileId) {
      setError('Invalid Google Sheets URL. Expected format: https://docs.google.com/spreadsheets/d/{id}/edit');
      return;
    }

    onLoadingChange?.(true);
    try {
      const result = await importService.importGoogleSheet(fileId);
      onParsed({ ...result, allRows: result.previewRows }); // API returns preview; full data comes from validate
    } catch (err: any) {
      setError(err?.response?.data || err?.message || 'Failed to connect to Google Sheet.');
    } finally {
      onLoadingChange?.(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://docs.google.com/spreadsheets/d/…/edit"
          className="flex-1 px-4 py-3 text-base border-2 border-border rounded-lg bg-white text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 transition-all"
          disabled={isLoading}
        />
        <button
          onClick={handleConnect}
          disabled={!url.trim() || isLoading}
          className="px-6 py-3 font-bold rounded-lg bg-brand-cyan text-brand-dark hover:shadow-cyan-glow transition-all disabled:opacity-50 whitespace-nowrap"
        >
          {isLoading ? 'Connecting…' : '📊 Connect'}
        </button>
      </div>
      {error && <p className="text-sm text-danger font-bold">{error}</p>}
      <p className="text-xs text-text-muted">
        Paste the full URL of your Google Sheet. The sheet must be shared (at least "Anyone with the link can view").
      </p>
    </div>
  );
}
