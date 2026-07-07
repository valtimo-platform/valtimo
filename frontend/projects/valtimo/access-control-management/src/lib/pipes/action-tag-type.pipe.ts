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

import {Pipe, PipeTransform} from '@angular/core';
import {TagType} from 'carbon-components-angular';
import {ACTION_TAG_TYPE, DEFAULT_ACTION_TAG_TYPE} from '../constants';

// Maps a permission action key (e.g. "create") to a tag colour, so each kind of action is shown with
// its own distinct colour. The colour may be a Carbon built-in or one of the extended case-widget
// colours registered globally in carbon.scss (e.g. "orange", "periwinkle"); the latter are cast to
// TagType so they satisfy the cds-tag input. Falls back to a neutral colour for unknown actions.
@Pipe({
  standalone: true,
  name: 'actionTagType',
})
export class ActionTagTypePipe implements PipeTransform {
  public transform(action: string | null | undefined): TagType {
    if (!action) return DEFAULT_ACTION_TAG_TYPE as TagType;
    return (ACTION_TAG_TYPE[action] ?? DEFAULT_ACTION_TAG_TYPE) as TagType;
  }
}
