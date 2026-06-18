// Robust copy-to-clipboard. The async Clipboard API (navigator.clipboard) is
// only present in a SECURE context (https or localhost); served over plain HTTP
// on a LAN host/IP it's undefined, so a bare `navigator.clipboard?.writeText`
// silently no-ops. This falls back to the legacy execCommand path, and finally
// to a prompt so the value is always recoverable. Returns true when the bytes
// were placed on the clipboard programmatically (prompt fallback returns false).
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* permissions / not-allowed — fall through to execCommand */
  }

  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '-1000px';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    if (ok) return true;
  } catch {
    /* execCommand unavailable — fall through to prompt */
  }

  // Last resort: surface the value so the user can copy it by hand.
  try { window.prompt('Copy this link:', text); } catch { /* ignore */ }
  return false;
}
