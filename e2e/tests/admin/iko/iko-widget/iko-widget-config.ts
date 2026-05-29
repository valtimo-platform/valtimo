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

import {WIDGET_WIZARD_TYPE_TEST_IDS} from '../../../../constants';
import {generateId} from '../../../../utils/dataGenerator';

/** Shared prefix used for every widget / divider title created by this suite. */
export const IKO_WIDGET_TITLE_PREFIX = 'E2E IKO Widget';
export const IKO_WIDGET_DIVIDER_TITLE_PREFIX = 'E2E IKO Divider';

/**
 * Tile labels exposed by the shared widget wizard. The IKO management page
 * restricts the available widget types to the five listed below — anything
 * outside this set must NOT appear on the type-selection step.
 */
export const IKO_WIDGET_TYPE_TILES = {
  fields: WIDGET_WIZARD_TYPE_TEST_IDS.tileFields,
  collection: WIDGET_WIZARD_TYPE_TEST_IDS.tileCollection,
  table: WIDGET_WIZARD_TYPE_TEST_IDS.tileTable,
  interactiveTable: WIDGET_WIZARD_TYPE_TEST_IDS.tileInteractiveTable,
  map: WIDGET_WIZARD_TYPE_TEST_IDS.tileMap,
} as const;

export const IKO_WIDGET_UNAVAILABLE_TYPE_TILES = [
  WIDGET_WIZARD_TYPE_TEST_IDS.tileCustom,
  WIDGET_WIZARD_TYPE_TEST_IDS.tileFormio,
  WIDGET_WIZARD_TYPE_TEST_IDS.tilePersonCard,
  WIDGET_WIZARD_TYPE_TEST_IDS.tileMetroline,
] as const;

/**
 * Column headers shown on the widget list table. The set is driven by the
 * wizard steps configured for the `iko` context, see
 * `WidgetManagementEditorComponent.fields$`.
 */
export const IKO_WIDGET_HEADERS = ['Title', 'Type', 'Key'] as const;

export const ikoWidgetConfig = {
  widgetTitlePrefix: IKO_WIDGET_TITLE_PREFIX,
  dividerTitlePrefix: IKO_WIDGET_DIVIDER_TITLE_PREFIX,
} as const;

export function uniqueWidgetTitle(label: string): string {
  return `${IKO_WIDGET_TITLE_PREFIX} ${label} ${generateId()}`;
}

export function uniqueDividerTitle(label: string): string {
  return `${IKO_WIDGET_DIVIDER_TITLE_PREFIX} ${label} ${generateId()}`;
}

/** Shape of a widget configuration entry as stored by the IKO widget API. */
export interface IkoWidgetPayload {
  type: string;
  key: string;
  title: string;
  width: 1 | 2 | 3 | 4;
  highContrast: boolean;
  color: string;
  isCompact: boolean;
  displayConditions: unknown[];
  actions: unknown[];
  properties: Record<string, unknown>;
}

/**
 * Builds a complete, valid widget payload for the given type. The `properties`
 * are the minimal valid shape for each type as defined by the `@valtimo/layout`
 * widget content models — enough for the backend to persist the widget and for
 * the management list to render its Title / Type / Key columns.
 */
function buildWidget(
  type: string,
  key: string,
  title: string,
  properties: Record<string, unknown>
): IkoWidgetPayload {
  return {
    type,
    key,
    title,
    width: 2,
    highContrast: false,
    color: 'WHITE',
    isCompact: false,
    displayConditions: [],
    actions: [],
    properties,
  };
}

/**
 * Every widget type the IKO widget editor exposes (see
 * `iko-management-widgets.component.ts` → `AVAILABLE_WIDGET_TYPES`). Each spec
 * carries the human-readable Type-column tag label (from the `widgetTabManagement.type.*`
 * translations) and a builder producing a minimal valid configuration.
 */
export interface IkoWidgetTypeSpec {
  /** Internal widget type discriminator stored in the configuration. */
  type: string;
  /** Wizard tile test id (the type-selection step). */
  tileTestId: string;
  /** Type-column tag label shown in the widget list. */
  typeLabel: string;
  /** Short slug used in generated keys / titles. */
  slug: string;
  build: (key: string, title: string) => IkoWidgetPayload;
}

export const IKO_WIDGET_TYPE_SPECS: IkoWidgetTypeSpec[] = [
  {
    type: 'fields',
    tileTestId: IKO_WIDGET_TYPE_TILES.fields,
    typeLabel: 'Fields',
    slug: 'fields',
    build: (key, title) =>
      buildWidget('fields', key, title, {
        columns: [[{key: 'field1', title: 'Field 1', value: '/basisgegevens/bsn'}]],
      }),
  },
  {
    type: 'collection',
    tileTestId: IKO_WIDGET_TYPE_TILES.collection,
    typeLabel: 'Collection',
    slug: 'collection',
    build: (key, title) =>
      buildWidget('collection', key, title, {
        collection: '/items',
        defaultPageSize: 10,
        title: {value: '/items/name'},
        fields: [{key: 'col1', title: 'Column 1', value: '/items/value', width: 'full'}],
      }),
  },
  {
    type: 'table',
    tileTestId: IKO_WIDGET_TYPE_TILES.table,
    typeLabel: 'Table',
    slug: 'table',
    build: (key, title) =>
      buildWidget('table', key, title, {
        collection: '/items',
        firstColumnAsTitle: false,
        defaultPageSize: 10,
        columns: [{key: 'col1', title: 'Column 1', value: '/items/value'}],
      }),
  },
  {
    type: 'interactive-table',
    tileTestId: IKO_WIDGET_TYPE_TILES.interactiveTable,
    typeLabel: 'Interactive table',
    slug: 'interactive-table',
    // `rowClickAction` is intentionally omitted: the backend models it as a
    // polymorphic `WidgetAction` resolved via Jackson DEDUCTION, so an empty
    // object cannot be deserialized. It is optional, matching the demo config.
    build: (key, title) =>
      buildWidget('interactive-table', key, title, {
        collection: '/items',
        defaultPageSize: 10,
        canStartCase: false,
        firstColumnAsTitle: false,
        columns: [{key: 'col1', title: 'Column 1', value: '/items/value'}],
      }),
  },
  {
    type: 'map',
    tileTestId: IKO_WIDGET_TYPE_TILES.map,
    typeLabel: 'Map',
    slug: 'map',
    build: (key, title) =>
      buildWidget('map', key, title, {
        geoJsonSources: [{key: '/geometry'}],
      }),
  },
];
