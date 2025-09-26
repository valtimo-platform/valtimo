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

import {ViewType} from '@valtimo/components';
import {DOCUMENTEN_COLUMN_KEYS} from './documenten-api.model';

interface ConfiguredColumn {
  key: string;
  sortable: boolean;
  filterable: boolean;
  defaultSort: 'ASC' | 'DESC' | null;
}

const COLUMN_VIEW_TYPES: {[key: string]: ViewType} = {
  [DOCUMENTEN_COLUMN_KEYS.CREATIEDATUM]: ViewType.DATE,
  [DOCUMENTEN_COLUMN_KEYS.LOCKED]: ViewType.BOOLEAN,
  [DOCUMENTEN_COLUMN_KEYS.TREFWOORDEN]: ViewType.TAGS,
  [DOCUMENTEN_COLUMN_KEYS.STATUS]: ViewType.TEMPLATE,
  [DOCUMENTEN_COLUMN_KEYS.TAAL]: ViewType.TEMPLATE,
  [DOCUMENTEN_COLUMN_KEYS.VERTROUWELIJKHEIDAANDUIDING]: ViewType.TEMPLATE,
};

export {ConfiguredColumn, COLUMN_VIEW_TYPES};
