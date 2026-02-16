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
import {WidgetWizardContentStepComponent} from './widget-wizard-content-step/widget-wizard-content-step.component';
import {WidgetWizardDensityStepComponent} from './widget-wizard-density-step/widget-wizard-density-step.component';
import {WidgetWizardDisplayConditionsStepComponent} from './widget-wizard-display-conditions-step/widget-wizard-display-conditions-step.component';
import {WidgetWizardAppearanceStepComponent} from './widget-wizard-appearance-step/widget-wizard-appearance-step.component';
import {WidgetWizardTypeStepComponent} from './widget-wizard-type-step/widget-wizard-type-step.component';
import {WidgetWizardWidthStepComponent} from './widget-wizard-width-step/widget-wizard-width-step.component';
import {WidgetWizardFiltersStepComponent} from './widget-wizard-filters-step/widget-wizard-filters-step.component';

export const WIDGET_STEPS = [
  WidgetWizardContentStepComponent,
  WidgetWizardAppearanceStepComponent,
  WidgetWizardDensityStepComponent,
  WidgetWizardTypeStepComponent,
  WidgetWizardWidthStepComponent,
  WidgetWizardFiltersStepComponent,
  WidgetWizardDisplayConditionsStepComponent,
];
