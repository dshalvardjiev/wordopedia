import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.jsx';
import './styles.css';

// Offline support; a new version installs in the background and takes over on the next start.
registerSW({ immediate: true });
createRoot(document.getElementById('root')).render(<StrictMode><App /></StrictMode>);
