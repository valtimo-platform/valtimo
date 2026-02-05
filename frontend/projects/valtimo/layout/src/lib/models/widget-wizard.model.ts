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
// import {CaseWidgetType} from '@valtimo/case';
import {Type} from '@angular/core';

import {
  WidgetManagementCollectionComponent,
  WidgetManagementCustomComponent,
  WidgetManagementFieldsComponent,
  WidgetManagementMapComponent,
  WidgetManagementTableComponent,
} from '../components/widget-management/management-content';
import {WidgetManagementInteractiveTableComponent} from '../components/widget-management/management-content/interactive-table/widget-management-interactive-table.component';
import {BasicWidget, WidgetColor, WidgetType} from './widget.model';
import {WidgetWizardTypeStepComponent} from '../components/widget-management/management-wizard/steps/widget-wizard-type-step/widget-wizard-type-step.component';
import {WidgetWizardWidthStepComponent} from '../components/widget-management/management-wizard/steps/widget-wizard-width-step/widget-wizard-width-step.component';
import {WidgetWizardStyleStepComponent} from '../components/widget-management/management-wizard/steps/widget-wizard-style-step/widget-wizard-style-step.component';
import {WidgetWizardContentStepComponent} from '../components/widget-management/management-wizard/steps/widget-wizard-content-step/widget-wizard-content-step.component';
import {WidgetWizardDisplayConditionsStepComponent} from '../components/widget-management/management-wizard/steps/widget-wizard-display-conditions-step/widget-wizard-display-conditions-step.component';
import {WidgetManagementWidgetFormioComponent} from '../components/widget-management/management-content/formio/widget-management-widget-formio.component';
import {WidgetWizardDensityStepComponent} from '../components/widget-management/management-wizard/steps/widget-wizard-density-step/widget-wizard-density-step.component';
import {WidgetWizardFiltersStepComponent} from '../components/widget-management/management-wizard/steps/widget-wizard-filters-step/widget-wizard-filters-step.component';
import {WidgetWizardAppearanceStepComponent} from '../components/widget-management/management-wizard/steps/widget-wizard-appearance-step/widget-wizard-appearance-step.component';

enum WidgetWizardStep {
  TYPE = 'type',
  WIDTH = 'width',
  DENSITY = 'density',
  STYLE = 'style',
  APPEARANCE = 'appearance',
  CONTENT = 'content',
  FILTERS = 'filters',
  DISPLAY_CONDITIONS = 'displayConditions',
}

enum WidgetWizardCloseEventType {
  CANCEL = 'cancel',
  CREATE = 'create',
  EDIT = 'edit',
}

enum WidgetStyle {
  DEFAULT = 'default',
  HIGH_CONTRAST = 'high-contrast',
}

enum WidgetDensity {
  DEFAULT = 'default',
  COMPACT = 'compact',
}

interface WidgetWizardCloseEvent {
  type: WidgetWizardCloseEventType;
  widget: BasicWidget | null;
}

interface WidgetTypeSelection {
  titleKey: string;
  descriptionKey: string;
  illustrationUrl: string;
  type: WidgetType;
  component: Type<any>;
}

const WIZARD_STEP_COMPONENTS: Record<WidgetWizardStep, any> = {
  [WidgetWizardStep.TYPE]: WidgetWizardTypeStepComponent,
  [WidgetWizardStep.WIDTH]: WidgetWizardWidthStepComponent,
  [WidgetWizardStep.DENSITY]: WidgetWizardDensityStepComponent,
  [WidgetWizardStep.STYLE]: WidgetWizardStyleStepComponent,
  [WidgetWizardStep.APPEARANCE]: WidgetWizardAppearanceStepComponent,
  [WidgetWizardStep.CONTENT]: WidgetWizardContentStepComponent,
  [WidgetWizardStep.FILTERS]: WidgetWizardFiltersStepComponent,
  [WidgetWizardStep.DISPLAY_CONDITIONS]: WidgetWizardDisplayConditionsStepComponent,
};

const AVAILABLE_WIDGETS: WidgetTypeSelection[] = [
  {
    titleKey: 'widgetTabManagement.type.fields.title',
    descriptionKey: 'widgetTabManagement.type.fields.description',
    illustrationUrl: 'valtimo-layout/img/widget-management/types/fields.svg',
    type: WidgetType.FIELDS,
    component: WidgetManagementFieldsComponent,
  },
  {
    titleKey: 'widgetTabManagement.type.custom.title',
    descriptionKey: 'widgetTabManagement.type.custom.description',
    illustrationUrl: 'valtimo-layout/img/widget-management/types/angular.svg',
    type: WidgetType.CUSTOM,
    component: WidgetManagementCustomComponent,
  },
  {
    titleKey: 'widgetTabManagement.type.formio.title',
    descriptionKey: 'widgetTabManagement.type.formio.description',
    illustrationUrl: 'valtimo-layout/img/widget-management/types/formio.svg',
    type: WidgetType.FORMIO,
    component: WidgetManagementWidgetFormioComponent,
  },
  {
    titleKey: 'widgetTabManagement.type.table.title',
    descriptionKey: 'widgetTabManagement.type.table.description',
    illustrationUrl: 'valtimo-layout/img/widget-management/types/table.svg',
    type: WidgetType.TABLE,
    component: WidgetManagementTableComponent,
  },
  {
    titleKey: 'widgetTabManagement.type.interactive-table.title',
    descriptionKey: 'widgetTabManagement.type.interactive-table.description',
    illustrationUrl: 'valtimo-layout/img/widget-management/types/table.svg',
    type: WidgetType.INTERACTIVE_TABLE,
    component: WidgetManagementInteractiveTableComponent,
  },
  {
    titleKey: 'widgetTabManagement.type.collection.title',
    descriptionKey: 'widgetTabManagement.type.collection.description',
    illustrationUrl: 'valtimo-layout/img/widget-management/types/collection.svg',
    type: WidgetType.COLLECTION,
    component: WidgetManagementCollectionComponent,
  },
  {
    titleKey: 'widgetTabManagement.type.map.title',
    descriptionKey: 'widgetTabManagement.type.map.description',
    illustrationUrl: 'valtimo-layout/img/widget-management/types/map.svg',
    type: WidgetType.MAP,
    component: WidgetManagementMapComponent,
  },
];

const WIDGET_WIDTH_LABELS: {[key: number]: string} = {
  1: 'widgetTabManagement.width.small.title',
  2: 'widgetTabManagement.width.medium.title',
  3: 'widgetTabManagement.width.large.title',
  4: 'widgetTabManagement.width.xtraLarge.title',
};

const WIDGET_STYLE_LABELS: {[key: string]: string} = {
  [WidgetStyle.DEFAULT]: 'widgetTabManagement.style.default.title',
  [WidgetStyle.HIGH_CONTRAST]: 'widgetTabManagement.style.highContrast.title',
};

const WIDGET_COLOR_LABELS: {[key in WidgetColor]: string} = {
  [WidgetColor.YELLOW]: 'widgetTabManagement.appearance.backgroundColor.colors.yellow',
  [WidgetColor.ORANGE]: 'widgetTabManagement.appearance.backgroundColor.colors.orange',
  [WidgetColor.RED]: 'widgetTabManagement.appearance.backgroundColor.colors.red',
  [WidgetColor.BROWN]: 'widgetTabManagement.appearance.backgroundColor.colors.brown',
  [WidgetColor.GREEN]: 'widgetTabManagement.appearance.backgroundColor.colors.green',
  [WidgetColor.TURQOISE]: 'widgetTabManagement.appearance.backgroundColor.colors.turqoise',
  [WidgetColor.PURPLE]: 'widgetTabManagement.appearance.backgroundColor.colors.purple',
  [WidgetColor.PERIWINKLE]: 'widgetTabManagement.appearance.backgroundColor.colors.periwinkle',
  [WidgetColor.BLUE]: 'widgetTabManagement.appearance.backgroundColor.colors.blue',
  [WidgetColor.WHITE]: 'widgetTabManagement.appearance.backgroundColor.colors.white',
};

const WIDGET_DENSITY_LABELS: {[key: string]: string} = {
  [WidgetDensity.DEFAULT]: 'widgetTabManagement.density.default.title',
  [WidgetDensity.COMPACT]: 'widgetTabManagement.density.compact.title',
};

export {
  AVAILABLE_WIDGETS,
  WIDGET_COLOR_LABELS,
  WIDGET_DENSITY_LABELS,
  WIDGET_STYLE_LABELS,
  WIDGET_WIDTH_LABELS,
  WidgetDensity,
  WidgetStyle,
  WidgetTypeSelection,
  WidgetWizardCloseEvent,
  WidgetWizardCloseEventType,
  WidgetWizardStep,
  WIZARD_STEP_COMPONENTS,
};
