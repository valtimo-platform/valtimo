import React from 'react';
import { createRoot } from 'react-dom/client';
import '@carbon/styles/css/styles.css';
import '../shared/styles.css';
import { PlanGoals } from './PlanGoals';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <PlanGoals />
  </React.StrictMode>
);
