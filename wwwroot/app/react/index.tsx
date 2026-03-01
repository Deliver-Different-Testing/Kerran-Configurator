import React from 'react';
import { createRoot } from 'react-dom/client';
import { AppSetupPage } from './components/AppSetupPage';

const container = document.getElementById('configurator-root');
if (container) {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <AppSetupPage />
    </React.StrictMode>
  );
}
