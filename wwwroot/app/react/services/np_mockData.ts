/**
 * @deprecated Use np_devData.ts directly for dev fallback data.
 * This file is a re-export shim kept for backward compatibility.
 * All mock data now lives in np_devData.ts.
 *
 * Pages have been wired to real API services — this data is only used
 * as a dev fallback when the backend is unavailable.
 */
export * from './np_devData';
