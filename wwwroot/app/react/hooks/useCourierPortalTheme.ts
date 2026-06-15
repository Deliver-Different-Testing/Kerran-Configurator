import { useParams } from 'react-router-dom';

// Courier Portal (Phase 1) — branding/theme.
//
// The :tenantSlug in the URL is cosmetic (branding only; backend tenant
// resolution is per-deployment config). Phase 1 ships a single default theme
// keyed off the existing Tailwind brand tokens; real per-tenant branding
// (logo/colours from tenant config) is a later phase. Centralising it here
// means the applicant + courier shells share one source of truth.

export interface PortalTheme {
  slug: string;
  brandName: string;
  logoSrc: string;
  // Tailwind class tokens (already defined in the app's theme).
  headerClass: string;   // dark brand header bar
  accentBtnClass: string; // primary action button
}

const DEFAULT_THEME: Omit<PortalTheme, 'slug'> = {
  brandName: 'DFRNT Drive',
  // Assets are served under Vite's base (/dist/), not the site root — same as
  // Sidebar.tsx. Using a root-absolute '/dfrnt-logo.png' 404s.
  logoSrc: import.meta.env.BASE_URL + 'dfrnt-logo.png',
  headerClass: 'bg-brand-dark',
  accentBtnClass: 'bg-brand-cyan text-brand-dark hover:shadow-cyan-glow',
};

export function useCourierPortalTheme(): PortalTheme {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  return {
    slug: tenantSlug ?? 'portal',
    ...DEFAULT_THEME,
  };
}
