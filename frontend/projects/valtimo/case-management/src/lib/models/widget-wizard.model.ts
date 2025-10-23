// /*
//  * Copyright 2015-2025 Ritense BV, the Netherlands.
//  *
//  * Licensed under EUPL, Version 1.2 (the "License");
//  * you may not use this file except in compliance with the License.
//  * You may obtain a copy of the License at
//  *
//  * https://joinup.ec.europa.eu/collection/eupl/eupl-text-eupl-12
//  *
//  * Unless required by applicable law or agreed to in writing, software
//  * distributed under the License is distributed on an "AS IS" basis,
//  * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
//  * See the License for the specific language governing permissions and
//  * limitations under the License.
//  */

// import {Type} from '@angular/core';
// import {WidgetContentComponent} from './widget-content.model';
// import {CaseWidgetType} from '@valtimo/case';
// import {
//   CaseManagementWidgetCollectionComponent,
//   CaseManagementWidgetCustomComponent,
//   CaseManagementWidgetFieldsComponent,
//   CaseManagementWidgetFormioComponent,
//   CaseManagementWidgetTableComponent,
// } from '../components/case-management-detail/tabs/case-management-tabs/widget-tab/case-management-widget-configurators';

// enum WidgetWizardStep {
//   TYPE,
//   WIDTH,
//   STYLE,
//   CONTENT,
//   DISPLAY_CONDITIONS,
// }

// enum WidgetStyle {
//   DEFAULT = 'default',
//   HIGH_CONTRAST = 'high-contrast',
// }

// interface WidgetTypeSelection {
//   titleKey: string;
//   descriptionKey: string;
//   illustrationUrl: string;
//   type: CaseWidgetType;
//   component: Type<WidgetContentComponent>;
// }

// const AVAILABLE_WIDGETS: WidgetTypeSelection[] = [
//   {
//     titleKey: 'widgetTabManagement.type.fields.title',
//     descriptionKey: 'widgetTabManagement.type.fields.description',
//     illustrationUrl: 'valtimo-layout/img/widget-management/types/fields.svg',
//     type: CaseWidgetType.FIELDS,
//     component: CaseManagementWidgetFieldsComponent,
//   },
//   {
//     titleKey: 'widgetTabManagement.type.custom.title',
//     descriptionKey: 'widgetTabManagement.type.custom.description',
//     illustrationUrl: 'valtimo-layout/img/widget-management/types/angular.svg',
//     type: CaseWidgetType.CUSTOM,
//     component: CaseManagementWidgetCustomComponent,
//   },
//   {
//     titleKey: 'widgetTabManagement.type.formio.title',
//     descriptionKey: 'widgetTabManagement.type.formio.description',
//     illustrationUrl: 'valtimo-layout/img/widget-management/types/formio.svg',
//     type: CaseWidgetType.FORMIO,
//     component: CaseManagementWidgetFormioComponent,
//   },
//   {
//     titleKey: 'widgetTabManagement.type.table.title',
//     descriptionKey: 'widgetTabManagement.type.table.description',
//     illustrationUrl: 'valtimo-layout/img/widget-management/types/table.svg',
//     type: CaseWidgetType.TABLE,
//     component: CaseManagementWidgetTableComponent,
//   },
//   {
//     titleKey: 'widgetTabManagement.type.collection.title',
//     descriptionKey: 'widgetTabManagement.type.collection.description',
//     illustrationUrl: 'valtimo-layout/img/widget-management/types/collection.svg',
//     type: CaseWidgetType.COLLECTION,
//     component: CaseManagementWidgetCollectionComponent,
//   },
// ];

// const WIDGET_WIDTH_LABELS: {[key: number]: string} = {
//   1: 'widgetTabManagement.width.small.title',
//   2: 'widgetTabManagement.width.medium.title',
//   3: 'widgetTabManagement.width.large.title',
//   4: 'widgetTabManagement.width.xtraLarge.title',
// };

// const WIDGET_STYLE_LABELS: {[key: string]: string} = {
//   [WidgetStyle.DEFAULT]: 'widgetTabManagement.style.default.title',
//   [WidgetStyle.HIGH_CONTRAST]: 'widgetTabManagement.style.highContrast.title',
// };

// export {
//   WidgetWizardStep,
//   WidgetTypeSelection,
//   AVAILABLE_WIDGETS,
//   WidgetStyle,
//   WIDGET_WIDTH_LABELS,
//   WIDGET_STYLE_LABELS,
// };
