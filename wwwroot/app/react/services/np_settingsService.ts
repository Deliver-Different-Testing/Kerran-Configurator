// Phase 3 stub: see np_dashboardService.ts for the conversion pattern.

export interface NpSettings {
  name: string;
  code: string;
  address: string;
  phone: string;
  email: string;
  coverageAreas: string[];
  notifications: Record<string, boolean>;
  [key: string]: unknown;
}

let mockSettings: NpSettings = {
  name: 'Pacific Express Logistics',
  code: 'PXL',
  address: '142 N Michigan Ave, Chicago, IL 60601',
  phone: '312-555-0100',
  email: 'admin@pacificexpress.com',
  coverageAreas: ['Chicago', 'Dallas', 'Houston'],
  notifications: {
    complianceAlerts: true,
    newApplicants: true,
    invoicingReminders: false,
  },
};

export const settingsService = {
  getSettings(): NpSettings {
    return mockSettings;
  },

  updateProfile(profile: Partial<NpSettings>): NpSettings {
    mockSettings = { ...mockSettings, ...profile };
    return mockSettings;
  },

  updateConfig(config: Record<string, unknown>): void {
    mockSettings = { ...mockSettings, ...config };
  },
};
