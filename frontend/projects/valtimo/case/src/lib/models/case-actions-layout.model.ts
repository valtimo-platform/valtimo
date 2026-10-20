/*
 * Copyright 2015-2026 Ritense BV, the Netherlands.
 *
 * Licensed under EUPL, Version 1.2 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * https://joinup.ec.europa.eu/collection/eupl/eupl-text-eupl-12
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/** An action that can collapse to an icon-only button. */
type CaseActionsCollapsible = 'assignment' | 'start';

/**
 * Roomiest first: `inline` shows everything in full, `condensed` collapses the assignment,
 * `minimal` also the start button, `wrapped` additionally lets the groups wrap onto their own rows.
 */
type CaseActionsLayout = 'inline' | 'condensed' | 'minimal' | 'wrapped';

interface CaseActionsLayoutOption {
  layout: CaseActionsLayout;
  collapsed: Array<CaseActionsCollapsible>;
}

interface CaseActionsCollapsibleMeasurement {
  name: CaseActionsCollapsible;
  collapsed: boolean;
  width: number;
}

interface CaseActionsMeasurement {
  available: number;
  collapsibles: Array<CaseActionsCollapsibleMeasurement>;
  gap: number;
  groupWidths: Array<number>;
  padding: number;
}

interface CaseActionsDecision {
  layout: CaseActionsLayout;
  minWidth: number;
}

export {
  CaseActionsCollapsible,
  CaseActionsCollapsibleMeasurement,
  CaseActionsDecision,
  CaseActionsLayout,
  CaseActionsLayoutOption,
  CaseActionsMeasurement,
};
