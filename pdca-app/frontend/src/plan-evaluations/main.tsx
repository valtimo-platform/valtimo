import React from 'react';
import { createRoot } from 'react-dom/client';
import '@carbon/styles/css/styles.css';
import '../shared/styles.css';
import { PlanEvaluations } from './PlanEvaluations';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <PlanEvaluations />
  </React.StrictMode>
);
