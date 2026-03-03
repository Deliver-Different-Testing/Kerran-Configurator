import { useState, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import AppSetupPage from './components/AppSetupPage';
import Toast from './components/Toast';

export type ToastFn = (msg: string) => void;

export default function App() {
  const [toastMsg, setToastMsg] = useState('');
  const [toastVisible, setToastVisible] = useState(false);

  const showToast: ToastFn = useCallback((msg: string) => {
    setToastMsg(msg);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 2500);
  }, []);

  return (
    <>
      <Sidebar />
      <AppSetupPage showToast={showToast} />
      <Toast message={toastMsg} visible={toastVisible} />
    </>
  );
}
