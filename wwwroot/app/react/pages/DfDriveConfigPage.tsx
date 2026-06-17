import { useCallback, useState } from 'react';
import AppSetupPage from '../components/AppSetupPage';
import { AutomationsPage } from '../modules/automations';
import Toast from '../components/Toast';

export type ToastFn = (msg: string) => void;

// DF Drive Config (cleanup Item 4). App Setup + Automations now render as real
// routes inside the standard AppLayout (main sidebar) — the old
// DfDriveConfigShell with its nested second sidebar is gone. There's no app-wide
// toast, so each route keeps the shell's lightweight local toast.
function useLocalToast() {
  const [toastMsg, setToastMsg] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const showToast: ToastFn = useCallback((msg: string) => {
    setToastMsg(msg);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 2500);
  }, []);
  return { showToast, toast: <Toast message={toastMsg} visible={toastVisible} /> };
}

export function AppSetupRoute() {
  const { showToast, toast } = useLocalToast();
  return (
    <>
      <AppSetupPage showToast={showToast} />
      {toast}
    </>
  );
}

export function AutomationsRoute() {
  const { showToast, toast } = useLocalToast();
  return (
    <>
      <AutomationsPage showToast={showToast} />
      {toast}
    </>
  );
}
