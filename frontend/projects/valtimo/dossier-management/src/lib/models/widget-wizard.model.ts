/*
 * Copyright 2015-2024 Ritense BV, the Netherlands.
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

import {Type} from '@angular/core';
import {WidgetContentComponent} from './widget-content.model';
import {CaseWidgetType} from '@valtimo/dossier';
import {
  DossierManagementWidgetCollectionComponent,
  DossierManagementWidgetCustomComponent,
  DossierManagementWidgetFieldsComponent,
  DossierManagementWidgetFormioComponent,
  DossierManagementWidgetTableComponent,
} from '../components/dossier-management-widget-configurators';

enum WidgetWizardStep {
  TYPE,
  WIDTH,
  STYLE,
  CONTENT,
}

enum WidgetStyle {
  DEFAULT = 'default',
  HIGH_CONTRAST = 'high-contrast',
}

interface WidgetTypeSelection {
  titleKey: string;
  descriptionKey: string;
  illustrationUrl: string;
  type: CaseWidgetType;
  component: Type<WidgetContentComponent>;
}

const AVAILABLE_WIDGETS: WidgetTypeSelection[] = [
  {
    titleKey: 'widgetTabManagement.types.fields.title',
    descriptionKey: 'widgetTabManagement.types.fields.description',
    illustrationUrl: 'valtimo-layout/img/widget-management/types/fields.svg',
    type: CaseWidgetType.FIELDS,
    component: DossierManagementWidgetFieldsComponent,
  },
  {
    titleKey: 'widgetTabManagement.types.custom.title',
    descriptionKey: 'widgetTabManagement.types.custom.description',
    illustrationUrl: 'valtimo-layout/img/widget-management/types/angular.svg',
    type: CaseWidgetType.CUSTOM,
    component: DossierManagementWidgetCustomComponent,
  },
  {
    titleKey: 'widgetTabManagement.types.formio.title',
    descriptionKey: 'widgetTabManagement.types.formio.description',
    illustrationUrl: 'valtimo-layout/img/widget-management/types/formio.svg',
    type: CaseWidgetType.FORMIO,
    component: DossierManagementWidgetFormioComponent,
  },
  {
    titleKey: 'widgetTabManagement.types.table.title',
    descriptionKey: 'widgetTabManagement.types.table.description',
    illustrationUrl: 'valtimo-layout/img/widget-management/types/table.svg',
    type: CaseWidgetType.TABLE,
    component: DossierManagementWidgetTableComponent,
  },
  {
    titleKey: 'widgetTabManagement.types.collection.title',
    descriptionKey: 'widgetTabManagement.types.collection.description',
    illustrationUrl: 'valtimo-layout/img/widget-management/types/collection.svg',
    type: CaseWidgetType.COLLECTION,
    component: DossierManagementWidgetCollectionComponent,
  },
];

const WIDGET_WIDTH_LABELS: {[key: number]: string} = {
  1: 'widgetTabManagement.width.quarter.title',
  2: 'widgetTabManagement.width.half.title',
  3: 'widgetTabManagement.width.threeQuarters.title',
  4: 'widgetTabManagement.width.fullWidth.title',
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
};
