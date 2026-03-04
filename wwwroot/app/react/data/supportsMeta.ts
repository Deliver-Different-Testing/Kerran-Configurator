// Decoration metadata for courier support types (event types in the "App Support" group).
// Keys match the ucetName values seeded in migration 014.
// These are the existing hardcoded support types from the MAUI app.

export interface SupportMeta {
  icon: string;
  color: string;
  description: string;
  category: string; // Grouping label for display
  phase: 'pickup' | 'delivery' | 'both'; // Job phase this support applies to
  eventCode: string; // Legacy event code (C40XX)
}

export const SUPPORTS_META: Record<string, SupportMeta> = {
  // ── Can't Pickup Job ──
  'Call Me Please':                { icon: '📞', color: '#3bc7f4', description: 'Request a callback from dispatch', category: "Can't Pickup Job", phase: 'pickup', eventCode: 'C4047' },
  'Cancelled':                     { icon: '❌', color: '#dc3246', description: 'Job has been cancelled', category: "Can't Pickup Job", phase: 'pickup', eventCode: 'C4079' },
  'Car Needed':                    { icon: '🚗', color: '#fe811a', description: 'Car required for this pickup', category: "Can't Pickup Job", phase: 'pickup', eventCode: 'C4062' },
  'No Mail':                       { icon: '📭', color: '#824ae0', description: 'No mail available for collection', category: "Can't Pickup Job", phase: 'pickup', eventCode: 'C4071' },
  'Pickup Address Incorrect':      { icon: '📍', color: '#dc3246', description: 'Pickup address is wrong (suburb change, unknown, or new address)', category: "Can't Pickup Job", phase: 'pickup', eventCode: 'C4075' },
  'Rebook For A Later Time':       { icon: '🕐', color: '#fe811a', description: 'Reschedule pickup for later', category: "Can't Pickup Job", phase: 'pickup', eventCode: 'C4080' },
  'Swap Pickup & Delivery Address':{ icon: '🔄', color: '#2a4eff', description: 'Swap the pickup and delivery addresses', category: "Can't Pickup Job", phase: 'pickup', eventCode: 'C4081' },
  'Truck Needed':                  { icon: '🚛', color: '#fe811a', description: 'Truck required for this pickup', category: "Can't Pickup Job", phase: 'pickup', eventCode: 'C4064' },
  'Van Needed':                    { icon: '🚐', color: '#fe811a', description: 'Van required for this pickup', category: "Can't Pickup Job", phase: 'pickup', eventCode: 'C4063' },
  'Other (Pickup)':                { icon: '📋', color: '#824ae0', description: 'Other pickup issue not listed above', category: "Can't Pickup Job", phase: 'pickup', eventCode: 'C4082' },

  // ── Can't Deliver Job ──
  'Not Home':                      { icon: '🏠', color: '#fe811a', description: 'Recipient not home — check permission to leave', category: "Can't Deliver Job", phase: 'delivery', eventCode: 'C478' },
  'Closed - AM Redelivery':        { icon: '🌅', color: '#3bc7f4', description: 'Closed — schedule AM redelivery', category: "Can't Deliver Job", phase: 'delivery', eventCode: 'C4083' },
  'Closed - Redeliver Later Today':{ icon: '🔁', color: '#3bc7f4', description: 'Closed — redeliver later today', category: "Can't Deliver Job", phase: 'delivery', eventCode: 'C4084' },
  'Delivery Address Incorrect':    { icon: '📍', color: '#dc3246', description: 'Delivery address is wrong (suburb change, unknown, or new address)', category: "Can't Deliver Job", phase: 'delivery', eventCode: 'C4076' },
  'Other (Delivery)':              { icon: '📋', color: '#824ae0', description: 'Other delivery issue not listed above', category: "Can't Deliver Job", phase: 'delivery', eventCode: 'C4094' },

  // ── Feedback for Account Rep ──
  'Happy Customer':                { icon: '😊', color: '#13b964', description: 'Positive customer feedback', category: 'Feedback', phase: 'delivery', eventCode: 'C4095' },
  'Issue With Customer':           { icon: '😐', color: '#fe811a', description: 'Report an issue with a customer', category: 'Feedback', phase: 'delivery', eventCode: 'C4096' },
  'Under Attack':                  { icon: '🚨', color: '#dc3246', description: 'Courier feels threatened or unsafe', category: 'Feedback', phase: 'delivery', eventCode: 'C4097' },
  'Unhappy Customer':              { icon: '😠', color: '#dc3246', description: 'Negative customer feedback', category: 'Feedback', phase: 'delivery', eventCode: 'C4098' },

  // ── Dangerous Goods ──
  'DG - Have Documentation':       { icon: '☣️', color: '#fe811a', description: 'Dangerous goods with proper documentation', category: 'Dangerous Goods', phase: 'delivery', eventCode: 'C4085' },
  'DG - No Documentation':         { icon: '⚠️', color: '#dc3246', description: 'Dangerous goods without documentation — likely cannot transport', category: 'Dangerous Goods', phase: 'delivery', eventCode: 'C4086' },

  // ── GPS ──
  'GPS':                           { icon: '📡', color: '#3bc7f4', description: 'GPS informational event', category: 'GPS', phase: 'both', eventCode: 'C4057' },

  // ── Job Not Ready ──
  'Job Not Ready - 5 min':         { icon: '⏱️', color: '#fe811a', description: 'Job not ready — wait 5 minutes', category: 'Job Not Ready', phase: 'delivery', eventCode: 'C4087' },
  'Job Not Ready - 10 min':        { icon: '⏱️', color: '#fe811a', description: 'Job not ready — wait 10 minutes', category: 'Job Not Ready', phase: 'delivery', eventCode: 'C4088' },
  'Job Not Ready - 15 min':        { icon: '⏱️', color: '#fe811a', description: 'Job not ready — wait 15 minutes', category: 'Job Not Ready', phase: 'delivery', eventCode: 'C4089' },
  'Job Not Ready - 20 min':        { icon: '⏱️', color: '#fe811a', description: 'Job not ready — wait 20 minutes', category: 'Job Not Ready', phase: 'delivery', eventCode: 'C4090' },
  'Job Not Ready - 30 min':        { icon: '⏱️', color: '#fe811a', description: 'Job not ready — wait 30 minutes', category: 'Job Not Ready', phase: 'delivery', eventCode: 'C4091' },

  // ── Other ──
  'Other (General)':               { icon: '📝', color: '#824ae0', description: 'General support request', category: 'Other', phase: 'both', eventCode: 'C4066' },

  // ── Truck ──
  'Truck - On Site':               { icon: '🚛', color: '#2a4eff', description: 'Truck on site', category: 'Truck', phase: 'delivery', eventCode: 'C4099' },
  'Truck - Hand Onload':           { icon: '🤲', color: '#2a4eff', description: 'Manual hand loading required', category: 'Truck', phase: 'delivery', eventCode: 'C40100' },
  'Truck - Tail Lift Pickup':      { icon: '⬆️', color: '#2a4eff', description: 'Tail lift required at pickup', category: 'Truck', phase: 'pickup', eventCode: 'C40101' },
  'Truck - Tail Lift Delivery':    { icon: '⬇️', color: '#2a4eff', description: 'Tail lift required at delivery', category: 'Truck', phase: 'delivery', eventCode: 'C40102' },
  'Truck - Oversize':              { icon: '📏', color: '#2a4eff', description: 'Item is oversized', category: 'Truck', phase: 'delivery', eventCode: 'C40103' },
  'Truck - Overweight':            { icon: '⚖️', color: '#2a4eff', description: 'Item is overweight', category: 'Truck', phase: 'delivery', eventCode: 'C40104' },

  // ── External Links ──
  'External Link':                 { icon: '🔗', color: '#2563eb', description: 'Opens an external URL (Google Form, intranet, etc)', category: 'External Links', phase: 'both', eventCode: '' },
};

// All category names in display order
export const SUPPORT_CATEGORIES = [
  "Can't Pickup Job",
  "Can't Deliver Job",
  'Feedback',
  'Dangerous Goods',
  'GPS',
  'Job Not Ready',
  'Other',
  'Truck',
  'External Links',
] as const;
