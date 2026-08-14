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

import {TagType} from 'carbon-components-angular';
import {WidgetType} from './widget.model';

enum WidgetManagementTab {
  VISUAL = 'visual',
  JSON = 'json',
}

/**
 * The tag colour each widget type is shown with in the widget overview, so the type column can be
 * scanned at a glance.
 *
 * Carbon ships twelve tag types, but three of those are grays that are hard to tell apart, which
 * leaves too few usable colours for the number of widget types. The palette is therefore extended
 * with the colours registered in `carbon.scss` (`periwinkle`, `light-green`, `orange`, `brown`);
 * those follow Carbon's own tag recipe and flip with the theme like the built-in ones. `yellow` is
 * available too but deliberately unused: it is the one extended colour that struggles to carry
 * legible text at the tag's font size.
 *
 * Types outside Carbon's own `TagType` union are cast; their classnames are backed by the extended
 * tag colours in `carbon.scss`.
 */
const WidgetTypeTags: Record<WidgetType, TagType> = {
  [WidgetType.FIELDS]: 'blue',
  [WidgetType.TABLE]: 'purple',
  [WidgetType.INTERACTIVE_TABLE]: 'magenta',
  [WidgetType.COLLECTION]: 'teal',
  [WidgetType.MAP]: 'cyan',
  [WidgetType.FORMIO]: 'green',
  [WidgetType.HIGHLIGHT]: 'red',
  [WidgetType.PERSON_CARD]: 'periwinkle' as TagType,
  [WidgetType.METROLINE]: 'light-green' as TagType,
  [WidgetType.TEXT]: 'orange' as TagType,
  [WidgetType.CUSTOM]: 'brown' as TagType,
  [WidgetType.IMAGE]: 'cool-gray',
  [WidgetType.DIVIDER]: 'outline',
};

export {WidgetManagementTab, WidgetTypeTags};
