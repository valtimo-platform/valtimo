import React from 'react';
import { createRoot } from 'react-dom/client';
import '@carbon/styles/css/styles.css';
import '../shared/styles.css';
import { PdcaAdmin } from './PdcaAdmin';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <PdcaAdmin />
  </React.StrictMode>
);
