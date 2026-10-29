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

import {InjectionToken} from '@angular/core';
import {ActionItem} from '@valtimo/components';

/**
 * Multi-provider token that external plugins use to contribute their own overflow-menu action
 * (e.g. an "edit content" action backed by a document-editing plugin) to the case document list,
 * without the list itself depending on which plugins are installed. Each provider entry
 * (`{provide: DOCUMENT_ACTION_ITEM_TOKEN, useValue: ..., multi: true}`) contributes one ActionItem;
 * the documents component merges all contributed items into its own fixed action list. The item's
 * callback/disabled$/hidden$ receive the row's `DocumentenApiRelatedFile`.
 */
export const DOCUMENT_ACTION_ITEM_TOKEN = new InjectionToken<ActionItem[]>(
  'DOCUMENT_ACTION_ITEM_TOKEN'
);
