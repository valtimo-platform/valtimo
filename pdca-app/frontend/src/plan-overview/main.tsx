import React from 'react';
import { createRoot } from 'react-dom/client';
import '@carbon/styles/css/styles.css';
import '../shared/styles.css';
import { PlanOverview } from './PlanOverview';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <PlanOverview />
  </React.StrictMode>
);
