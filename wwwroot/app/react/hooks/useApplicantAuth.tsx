import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { applicantToken } from '@/services/applicant_api';
import {
  portalApplicantService,
  type PortalApplicant,
  type ProgressPayload,
  type RegisterPayload,
} from '@/services/portal_applicantService';

// Courier Portal (Phase 1) — applicant session state.
//
// Auth is the signed X-Portal-Token (not JWT). The token lives in localStorage
// (applicant_api injects it). This provider holds the React-side mirror so all
// applicant pages see the same logged-in applicant + actions. Wrap the
// /apply/* route tree in <ApplicantAuthProvider>.

interface ApplicantAuthValue {
  applicant: PortalApplicant | null;
  loading: boolean;          // initial "am I logged in?" resolution
  isAuthenticated: boolean;
  register: (p: RegisterPayload) => Promise<{ email: string }>;
  verify: (email: string, code: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  saveProgress: (p: ProgressPayload) => Promise<void>;
  submit: (fullName: string) => Promise<void>;
  logout: () => void;
}

const ApplicantAuthContext = createContext<ApplicantAuthValue | null>(null);

export function ApplicantAuthProvider({ children }: { children: ReactNode }) {
  const [applicant, setApplicant] = useState<PortalApplicant | null>(null);
  const [loading, setLoading] = useState(true);

  // On mount: if a token is present, resolve the applicant. A 401/expired token
  // is cleared so the UI falls back to the entry/login screens.
  useEffect(() => {
    let alive = true;
    if (!applicantToken.get()) {
      setLoading(false);
      return;
    }
    portalApplicantService.me()
      .then(a => { if (alive) setApplicant(a); })
      .catch(() => { applicantToken.clear(); if (alive) setApplicant(null); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const register = useCallback(async (p: RegisterPayload) => {
    const res = await portalApplicantService.register(p);
    return { email: res.email };
  }, []);

  const adoptSession = useCallback((token: string, a: PortalApplicant) => {
    applicantToken.set(token);
    setApplicant(a);
  }, []);

  const verify = useCallback(async (email: string, code: string) => {
    const s = await portalApplicantService.verify(email, code);
    adoptSession(s.token, s.applicant);
  }, [adoptSession]);

  const login = useCallback(async (email: string, password: string) => {
    const s = await portalApplicantService.login(email, password);
    adoptSession(s.token, s.applicant);
  }, [adoptSession]);

  const saveProgress = useCallback(async (p: ProgressPayload) => {
    const updated = await portalApplicantService.saveProgress(p);
    setApplicant(updated);
  }, []);

  const submit = useCallback(async (fullName: string) => {
    const updated = await portalApplicantService.submit(fullName);
    setApplicant(updated);
  }, []);

  const logout = useCallback(() => {
    applicantToken.clear();
    setApplicant(null);
  }, []);

  const value = useMemo<ApplicantAuthValue>(() => ({
    applicant,
    loading,
    isAuthenticated: applicant !== null,
    register,
    verify,
    login,
    saveProgress,
    submit,
    logout,
  }), [applicant, loading, register, verify, login, saveProgress, submit, logout]);

  return <ApplicantAuthContext.Provider value={value}>{children}</ApplicantAuthContext.Provider>;
}

export function useApplicantAuth(): ApplicantAuthValue {
  const ctx = useContext(ApplicantAuthContext);
  if (!ctx) throw new Error('useApplicantAuth must be used inside <ApplicantAuthProvider>');
  return ctx;
}
