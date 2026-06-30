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

const WidgetTypeTags: Record<WidgetType, TagType> = {
  [WidgetType.COLLECTION]: 'teal',
  [WidgetType.CUSTOM]: 'magenta',
  [WidgetType.FIELDS]: 'blue',
  [WidgetType.FORMIO]: 'green',
  [WidgetType.TABLE]: 'purple',
  [WidgetType.INTERACTIVE_TABLE]: 'red',
  [WidgetType.MAP]: 'cyan',
  [WidgetType.IMAGE]: 'warm-gray',
  [WidgetType.DIVIDER]: 'orange' as TagType,
  [WidgetType.METROLINE]: 'light-green' as TagType,
  [WidgetType.PERSON_CARD]: 'yellow' as TagType,
  [WidgetType.HIGHLIGHT]: 'periwinkle' as TagType,
};

export {WidgetManagementTab, WidgetTypeTags};
