import type { TaskType } from '../types';

export const TASKS: TaskType[] = [
  { id: 'photo', icon: '📸', name: 'Photo Capture', desc: 'Take photo(s) as proof', cat: 'Capture', config: { minPhotos: 1, maxPhotos: 5, label: 'Delivery Photo', mandatory: 'delivery' } },
  { id: 'signature', icon: '✍️', name: 'Signature', desc: 'Capture recipient signature', cat: 'Capture', config: { signerNameReq: true, label: 'Recipient Signature' } },
  { id: 'checkbox', icon: '☑️', name: 'Checkbox Confirmation', desc: 'Tick to confirm action', cat: 'Confirmation', config: { label: 'Goods received undamaged' } },
  { id: 'age', icon: '🪪', name: 'Age Verification', desc: 'Check proof of age', cat: 'Verification', config: { minAge: 18, idTypes: ['Drivers Licence', 'Passport', 'Proof of Age Card'] } },
  { id: 'idverify', icon: '🆔', name: 'ID Verification', desc: 'Verify sender/receiver identity', cat: 'Verification', config: { matchField: 'Recipient Name', idTypes: ['Drivers Licence', 'Passport'] } },
  { id: 'templogger', icon: '🌡️', name: 'Temperature Logger', desc: 'Collect or deploy temp logger', cat: 'Capture', config: { action: 'collect', scanRequired: true } },
  { id: 'barcode', icon: '📦', name: 'Barcode Scan', desc: 'Scan barcode or QR code', cat: 'Capture', config: { mustMatch: true } },
  { id: 'prompt', icon: '💬', name: 'Custom Prompt', desc: 'Show message to courier', cat: 'Communication', config: { message: 'Please check parcel condition', acknowledge: true } },
  { id: 'notes', icon: '📝', name: 'Notes', desc: 'Free text entry field', cat: 'Capture', config: { label: 'Delivery Notes', required: false } },
  { id: 'dropdown', icon: '📋', name: 'Dropdown Select', desc: 'Choose from predefined list', cat: 'Capture', config: { label: 'Delivery Outcome', options: ['Delivered', 'Left at Door', 'Neighbour', 'Safe Place'] } },
  { id: 'geofence', icon: '📍', name: 'Geofence Check', desc: 'Confirm GPS within radius', cat: 'Verification', config: { radius: 100 } },
  { id: 'timestamp', icon: '⏱️', name: 'Time Stamp', desc: 'Record time at stage', cat: 'Confirmation', config: { mode: 'auto' } },
  { id: 'docupload', icon: '📄', name: 'Document Upload', desc: 'Upload or photograph document', cat: 'Capture', config: { label: 'Customs Document', docType: 'any' } },
  { id: 'clientnote', icon: '🔔', name: 'Client Note', desc: 'Show note/instruction from client', cat: 'Communication', config: { note: 'Handle with care — fragile contents', acknowledge: true } },
  { id: 'coldchain', icon: '🧊', name: 'Cold Chain Check', desc: 'Record temperature reading', cat: 'Verification', config: { minTemp: -2, maxTemp: 8, requirePhoto: true } },
  { id: 'instructionnote', icon: '📋', name: 'Instruction Note', desc: 'Display configurable instruction to courier', cat: 'Communication', config: { label: '', note: '', acknowledge: true } },
];

export const TASK_MAP = new Map(TASKS.map(t => [t.id, t]));
