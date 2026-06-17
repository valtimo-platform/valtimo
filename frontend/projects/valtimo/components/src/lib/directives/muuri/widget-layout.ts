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

import {muuriGapFreeLayout} from './muuri-gap-free-layout';

/**
 * Selectable widget layout algorithm. Persisted (optionally) per case widget
 * tab, IKO tab and dashboard; an absent value falls back to MUURI_GAP_FREE.
 *
 *  - MUURI_GAP_FREE ("Default (less gaps)"): Muuri's built-in masonry with gap
 *    filling — the behaviour from before the layout-algorithm work. Used when
 *    nothing is configured.
 *  - MUURI ("Default"): Muuri's plain masonry, without gap filling.
 *  - BEAUTIFUL ("Beautiful (gap-free)"): the custom search-based gap-free packing.
 */
enum WidgetLayout {
  MUURI_GAP_FREE = 'MUURI_GAP_FREE',
  MUURI = 'MUURI',
  BEAUTIFUL = 'BEAUTIFUL',
}

interface ResolvedWidgetLayout {
  // Value for Muuri's `layout` option: a custom function or an options object.
  // Typed loosely because Muuri accepts either shape here.
  muuriLayout: any;
  // Row-unit height (px) widgets snap to; finer for the gap-free algorithm.
  rowHeightUnit: number;
}

/** Row-unit height used by the default and plain Muuri algorithms. */
const WIDGET_ROW_HEIGHT_DEFAULT = 200;

/** Finer row-unit height the beautiful gap-free algorithm packs against. */
const WIDGET_ROW_HEIGHT_GAP_FREE = 92;

/**
 * Resolve a (possibly absent) layout choice to a concrete Muuri `layout` option
 * and the row-unit height widgets should snap to. Unknown/absent falls back to
 * MUURI_GAP_FREE (gap-filling Muuri — the pre-existing behaviour).
 */
function resolveWidgetLayout(layout?: WidgetLayout | null): ResolvedWidgetLayout {
  switch (layout) {
    case WidgetLayout.BEAUTIFUL:
      return {muuriLayout: muuriGapFreeLayout, rowHeightUnit: WIDGET_ROW_HEIGHT_GAP_FREE};
    case WidgetLayout.MUURI:
      return {muuriLayout: {fillGaps: false}, rowHeightUnit: WIDGET_ROW_HEIGHT_DEFAULT};
    case WidgetLayout.MUURI_GAP_FREE:
    default:
      return {muuriLayout: {fillGaps: true}, rowHeightUnit: WIDGET_ROW_HEIGHT_DEFAULT};
  }
}

/** Selectable layout values in display order, for admin dropdowns. */
const WIDGET_LAYOUT_VALUES: WidgetLayout[] = [
  WidgetLayout.MUURI_GAP_FREE,
  WidgetLayout.MUURI,
  WidgetLayout.BEAUTIFUL,
];

/** Translation keys for each layout value (under the shared `widgetLayout` namespace). */
const WIDGET_LAYOUT_TRANSLATION_KEYS: Record<WidgetLayout, string> = {
  [WidgetLayout.MUURI_GAP_FREE]: 'widgetLayout.muuriGapFree',
  [WidgetLayout.MUURI]: 'widgetLayout.muuri',
  [WidgetLayout.BEAUTIFUL]: 'widgetLayout.beautiful',
};

export {
  WidgetLayout,
  resolveWidgetLayout,
  WIDGET_ROW_HEIGHT_DEFAULT,
  WIDGET_ROW_HEIGHT_GAP_FREE,
  WIDGET_LAYOUT_VALUES,
  WIDGET_LAYOUT_TRANSLATION_KEYS,
};
export type {ResolvedWidgetLayout};
