
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { SettingsProvider } from './contexts/SettingsContext';
import { ResourceErrorProvider } from './contexts/ResourceErrorContext';
import { AuthGate } from './components/AuthGate';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    {/* 答题鉴权：凭证无效时整个站点被拦下，只有答对才能进入 */}
    <AuthGate>
      <SettingsProvider>
        <ResourceErrorProvider>
          <App />
        </ResourceErrorProvider>
      </SettingsProvider>
    </AuthGate>
  </React.StrictMode>
);
