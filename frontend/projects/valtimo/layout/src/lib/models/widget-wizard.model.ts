/*
 * Copyright 2015-2025 Ritense BV, the Netherlands.
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
  WidgetManagementTableComponent,
} from '../components/widget-management/management-content';
import {WidgetManagementInteractiveTableComponent} from '../components/widget-management/management-content/interactive-table/widget-management-interactive-table.component';
import {IWidgetContentComponent} from '../interfaces';
import {BasicWidget, WidgetType} from './widget.model';

enum WidgetWizardStep {
  TYPE,
  WIDTH,
  STYLE,
  CONTENT,
}

enum WidgetWizardCloseEventType {
  CANCEL,
  CREATE,
  EDIT,
}

enum WidgetStyle {
  DEFAULT = 'default',
  HIGH_CONTRAST = 'high-contrast',
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
  component: Type<IWidgetContentComponent>;
}

const AVAILABLE_WIDGETS: WidgetTypeSelection[] = [
  {
    titleKey: 'widgetTabManagement.types.fields.title',
    descriptionKey: 'widgetTabManagement.types.fields.description',
    illustrationUrl: 'valtimo-layout/img/widget-management/types/fields.svg',
    type: WidgetType.FIELDS,
    component: WidgetManagementFieldsComponent,
  },
  {
    titleKey: 'widgetTabManagement.types.custom.title',
    descriptionKey: 'widgetTabManagement.types.custom.description',
    illustrationUrl: 'valtimo-layout/img/widget-management/types/angular.svg',
    type: WidgetType.CUSTOM,
    component: WidgetManagementCustomComponent,
  },
  {
    titleKey: 'widgetTabManagement.types.table.title',
    descriptionKey: 'widgetTabManagement.types.table.description',
    illustrationUrl: 'valtimo-layout/img/widget-management/types/table.svg',
    type: WidgetType.TABLE,
    component: WidgetManagementTableComponent,
  },
  {
    titleKey: 'widgetTabManagement.types.interactive-table.title',
    descriptionKey: 'widgetTabManagement.types.interactive-table.description',
    illustrationUrl: 'valtimo-layout/img/widget-management/types/table.svg',
    type: WidgetType.INTERACTIVE_TABLE,
    component: WidgetManagementInteractiveTableComponent,
  },
  {
    titleKey: 'widgetTabManagement.types.collection.title',
    descriptionKey: 'widgetTabManagement.types.collection.description',
    illustrationUrl: 'valtimo-layout/img/widget-management/types/collection.svg',
    type: WidgetType.COLLECTION,
    component: WidgetManagementCollectionComponent,
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

export {
  WidgetWizardStep,
  WidgetTypeSelection,
  AVAILABLE_WIDGETS,
  WidgetStyle,
  WIDGET_WIDTH_LABELS,
  WIDGET_STYLE_LABELS,
  WidgetWizardCloseEventType,
  WidgetWizardCloseEvent,
};
