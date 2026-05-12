import type { PresetWorkflow } from '../types/configurator';

export const PRESETS: Record<string, PresetWorkflow> = {
  standard: {
    name: 'Standard',
    stages: {
      'Pickup': [
        { taskId: 'barcode', required: true, config: { mustMatch: true }, context: 'both' },
        { taskId: 'photo', required: true, config: { minPhotos: 1, maxPhotos: 2, label: 'Pickup Photo' }, context: 'both' },
      ],
      'Delivery': [
        { taskId: 'photo', required: true, config: { minPhotos: 1, maxPhotos: 3, label: 'Proof of Delivery' }, context: 'both' },
        { taskId: 'signature', required: true, config: { signerNameReq: true, label: 'Recipient Signature' }, context: 'both' },
      ],
    },
  },
  alcohol: {
    name: 'Alcohol',
    stages: {
      'Pickup': [
        { taskId: 'barcode', required: true, config: { mustMatch: true }, context: 'both' },
        { taskId: 'photo', required: true, config: { minPhotos: 1, maxPhotos: 2, label: 'Pickup Photo' }, context: 'both' },
      ],
      'Delivery': [
        { taskId: 'age', required: true, config: { minAge: 18, idTypes: ['Drivers Licence', 'Passport', 'Proof of Age Card'] }, context: 'both' },
        { taskId: 'photo', required: true, config: { minPhotos: 1, maxPhotos: 3, label: 'Proof of Delivery' }, context: 'both' },
        { taskId: 'signature', required: true, config: { signerNameReq: true, label: 'Recipient Signature' }, context: 'both' },
      ],
    },
  },
  medical: {
    name: 'Medical',
    stages: {
      'Pickup': [
        { taskId: 'idverify', required: true, config: { matchField: 'Sender Name', idTypes: ['Drivers Licence', 'Passport', 'Company ID'] }, context: 'both' },
        { taskId: 'barcode', required: true, config: { mustMatch: true }, context: 'both' },
        { taskId: 'photo', required: true, config: { minPhotos: 1, maxPhotos: 2, label: 'Pickup Photo' }, context: 'both' },
      ],
      'Enroute to Delivery': [
        { taskId: 'coldchain', required: true, config: { minTemp: 2, maxTemp: 8, requirePhoto: true }, context: 'both' },
      ],
      'Delivery': [
        { taskId: 'photo', required: true, config: { minPhotos: 2, maxPhotos: 5, label: 'Delivery Photo + Temp Display' }, context: 'both' },
        { taskId: 'prompt', required: true, config: { message: 'Collect the temperature logger from the client before leaving', acknowledge: true }, context: 'both' },
        { taskId: 'templogger', required: true, config: { action: 'collect', scanRequired: true }, context: 'both' },
        { taskId: 'signature', required: true, config: { signerNameReq: true, label: 'Recipient Signature' }, context: 'both' },
      ],
    },
  },
  minimal: {
    name: 'Minimal',
    stages: {
      'Delivery': [
        { taskId: 'checkbox', required: true, config: { label: 'Delivery completed' }, context: 'both' },
      ],
    },
  },
};
