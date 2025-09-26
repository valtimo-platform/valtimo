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

import {ListItem} from 'carbon-components-angular';

interface ValuePathSelectorCache {
  [documentDefinitionName: string]: {
    [version: string | number]: {
      [prefix: string]: string[];
    };
  };
}

interface ValuePathCollectionCache {
  [documentDefinitionName: string]: {
    [version: string | number]: {
      [prefix: string]: ValueCollectionCacheEntry;
    };
  };
}

interface ValueCollectionCacheEntry {
  [collectionPath: string]: string[];
}

interface ValueCollectionPath {
  content: string;
  prefix: string;
  unformattedPath: string;
}

type DocumentDefinitionItemsCache = ListItem[];

interface ValueResolverOption {
  prefixes: ValuePathSelectorPrefix[];
  type: ValueResolverOptionType;
}

interface ValueResolverResult {
  path: string;
  type: ValueResolverOptionType;
  children?: ValueResolverResult[];
}

enum ValuePathSelectorPrefix {
  DOC = 'doc',
  CASE = 'case',
  ZAAKOBJECT = 'zaakobject',
  ZAAKRESULTAAT = 'zaakresultaat',
  ZAAKSTATUS = 'zaakstatus',
  ZAAK = 'zaak',
}

enum ValueResolverOptionType {
  FIELD = 'FIELD',
  COLLECTION = 'COLLECTION',
}

enum ValuePathSelectorInputMode {
  DROPDOWN,
  MANUAL,
}

type ValuePathSelectorNotation = 'dots' | 'slashes';

type ValuePathVersionArgument = number | 'latest';

export {
  DocumentDefinitionItemsCache,
  ValueCollectionCacheEntry,
  ValueCollectionPath,
  ValuePathCollectionCache,
  ValuePathSelectorCache,
  ValuePathSelectorInputMode,
  ValuePathSelectorNotation,
  ValuePathSelectorPrefix,
  ValuePathVersionArgument,
  ValueResolverOption,
  ValueResolverOptionType,
  ValueResolverResult,
};
