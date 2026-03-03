// Decoration metadata for feature flags, keyed by AppConfig configKey (without 'feature.' prefix).
// Used to enrich AppConfig records from the API with display info.

export interface FeatureMeta {
  icon: string;
  displayName: string;
  description: string;
  type: 'standalone' | 'step-capability';
  taskIds?: string[]; // Only for step-capability: which task IDs this flag gates in the workflow builder
}

export const FEATURES_META: Record<string, FeatureMeta> = {
  // ── Step Capabilities (gate workflow builder task types) ──
  photoProofOfDelivery: { icon: '📸', displayName: 'Photo on Delivery', description: 'Require photo proof at delivery', type: 'step-capability', taskIds: ['photo'] },
  signatureCapture: { icon: '✍️', displayName: 'Signature Capture', description: 'Capture recipient signature on delivery', type: 'step-capability', taskIds: ['signature'] },
  barcodeScan: { icon: '🔖', displayName: 'Barcode Scanning', description: 'Scan parcels on pickup and delivery for tracking', type: 'step-capability', taskIds: ['barcode'] },
  smartParcelCapture: { icon: '📐', displayName: 'Smart Parcel Capture', description: 'AI-assisted parcel dimension and weight capture', type: 'step-capability', taskIds: [] },
  ageVerification: { icon: '🪪', displayName: 'Age Verification', description: 'Enable age verification checks during delivery', type: 'step-capability', taskIds: ['age'] },
  idVerification: { icon: '🆔', displayName: 'ID Verification', description: 'Verify sender/receiver identity', type: 'step-capability', taskIds: ['idverify'] },
  tempLogger: { icon: '🌡️', displayName: 'Temperature Logger', description: 'Enable temperature logger collection and deployment', type: 'step-capability', taskIds: ['templogger'] },
  coldChainCheck: { icon: '🧊', displayName: 'Cold Chain Check', description: 'Cold chain temperature verification', type: 'step-capability', taskIds: ['coldchain'] },

  // ── Standalone Features (simple on/off toggles, not workflow steps) ──
  gpsUpdate: { icon: '📡', displayName: 'GPS Location Update', description: 'Real-time courier location tracking', type: 'standalone' },
  liveChat: { icon: '💬', displayName: 'Live Chat', description: 'In-app messaging between courier and dispatch', type: 'standalone' },
  routeNavigation: { icon: '🧭', displayName: 'Route Navigation', description: 'In-app turn-by-turn navigation to job locations', type: 'standalone' },
  podEmail: { icon: '📧', displayName: 'POD Email', description: 'Auto-send proof of delivery via email to client', type: 'standalone' },
  courierLeadCapture: { icon: '💼', displayName: 'Courier Lead Capture', description: 'Allow couriers to capture new business leads in-app', type: 'standalone' },
  geofenceArrival: { icon: '📍', displayName: 'Geofence Arrival', description: 'Auto-detect courier arrival via GPS geofence', type: 'standalone' },
  deliveryNotes: { icon: '📝', displayName: 'Delivery Notes', description: 'Allow courier free-text notes on delivery', type: 'standalone' },
  weightDimensions: { icon: '⚖️', displayName: 'Weight & Dimensions', description: 'Manual weight and size capture by courier', type: 'standalone' },
  scheduling: { icon: '📅', displayName: 'Scheduling', description: 'Job scheduling and calendar integration', type: 'standalone' },
  multiBarcode: { icon: '📦', displayName: 'Multi Barcode', description: 'Scan multiple barcodes per job', type: 'standalone' },
};

// Build a reverse map: task ID → feature flag configKey (short form, e.g. 'barcodeScan')
// Used by the workflow builder to check if a task type is gated by a disabled feature flag.
export const TASK_TO_FEATURE_KEY: Record<string, string> = {};
for (const [key, meta] of Object.entries(FEATURES_META)) {
  if (meta.taskIds) {
    for (const taskId of meta.taskIds) {
      TASK_TO_FEATURE_KEY[taskId] = key;
    }
  }
}
