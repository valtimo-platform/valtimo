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

export const WIDGET_EDITOR_TEST_IDS = {
  addWidgetButton: 'widgetEditorAddWidgetButton',
  addDividerButton: 'widgetEditorAddDividerButton',
} as const;

export const WIDGET_WIZARD_TEST_IDS = {
  nextButton: 'widgetWizardNextButton',
  saveButton: 'widgetWizardSaveButton',
  cancelButton: 'widgetWizardCancelButton',
  backButton: 'widgetWizardBackButton',
} as const;

export const WIDGET_WIZARD_TYPE_TEST_IDS = {
  tileFields: 'widgetWizardTypeTile-fields',
  tileCustom: 'widgetWizardTypeTile-custom',
  tileFormio: 'widgetWizardTypeTile-formio',
  tileTable: 'widgetWizardTypeTile-table',
  tileInteractiveTable: 'widgetWizardTypeTile-interactive-table',
  tileCollection: 'widgetWizardTypeTile-collection',
  tileMap: 'widgetWizardTypeTile-map',
  tilePersonCard: 'widgetWizardTypeTile-person-card',
} as const;

export const WIDGET_WIZARD_WIDTH_TEST_IDS = {
  tileSmall: 'widgetWizardWidthTile-small',
  tileMedium: 'widgetWizardWidthTile-medium',
  tileLarge: 'widgetWizardWidthTile-large',
  tileXtraLarge: 'widgetWizardWidthTile-xtraLarge',
} as const;

export const WIDGET_WIZARD_DENSITY_TEST_IDS = {
  tileDefault: 'widgetWizardDensityTile-default',
  tileCompact: 'widgetWizardDensityTile-compact',
} as const;

export const WIDGET_WIZARD_APPEARANCE_TEST_IDS = {
  tileWhite: 'widgetWizardAppearanceTile-WHITE',
  tileBlue: 'widgetWizardAppearanceTile-BLUE',
  tileGreen: 'widgetWizardAppearanceTile-GREEN',
  tileYellow: 'widgetWizardAppearanceTile-YELLOW',
  tileOrange: 'widgetWizardAppearanceTile-ORANGE',
  tileRed: 'widgetWizardAppearanceTile-RED',
  tileBrown: 'widgetWizardAppearanceTile-BROWN',
  tileTurquoise: 'widgetWizardAppearanceTile-TURQOISE',
  tilePurple: 'widgetWizardAppearanceTile-PURPLE',
  tilePeriwinkle: 'widgetWizardAppearanceTile-PERIWINKLE',
  tileHighContrast: 'widgetWizardAppearanceTile-HIGHCONTRAST',
} as const;

export const WIDGET_DIVIDER_MODAL_TEST_IDS = {
  titleInput: 'widgetDividerModalTitleInput',
  createButton: 'widgetDividerModalCreateButton',
  cancelButton: 'widgetDividerModalCancelButton',
} as const;

export const WIDGET_CONTENT_FIELDS_TEST_IDS = {
  widgetTitleInput: 'widgetContentFieldsWidgetTitle',
  fieldTitleInput: 'widgetContentFieldsFieldTitle',
  displayTypeDropdown: 'widgetContentFieldsDisplayType',
  valuePathSelector: 'widgetContentFieldsValuePath',
} as const;

export const WIDGET_CONTENT_PERSON_CARD_TEST_IDS = {
  widgetTitleInput: 'widgetContentPersonCardWidgetTitle',
  fullNameInput: 'widgetContentPersonCardFullName',
  birthDateInput: 'widgetContentPersonCardBirthDate',
  bsnInput: 'widgetContentPersonCardBsn',
  phoneInput: 'widgetContentPersonCardPhone',
  emailInput: 'widgetContentPersonCardEmail',
  cityInput: 'widgetContentPersonCardCity',
} as const;
