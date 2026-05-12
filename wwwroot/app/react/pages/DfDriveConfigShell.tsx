import { useCallback, useState } from 'react';
import Sidebar from '../components/Sidebar';
import AppSetupPage from '../components/AppSetupPage';
import { AutomationsPage } from '../modules/automations';
import Toast from '../components/Toast';

export type ToastFn = (msg: string) => void;

// Existing DF Drive configurator UI lifted into a single "DF Admin" route.
// Uses internal page state (App Setup / Automations) to match the legacy UX
// — no router subroutes here on purpose to avoid disturbing the working tabs.
export default function DfDriveConfigShell() {
  const [toastMsg, setToastMsg] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const [activePage, setActivePage] = useState('appsetup');

  const showToast: ToastFn = useCallback((msg: string) => {
    setToastMsg(msg);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 2500);
  }, []);

  return (
    <>
      <Sidebar activePage={activePage} onNavigate={setActivePage} />
      {activePage === 'automations' ? (
        <AutomationsPage showToast={showToast} />
      ) : (
        <AppSetupPage showToast={showToast} />
      )}
      <Toast message={toastMsg} visible={toastVisible} />
    </>
  );
}
