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

import {of} from 'rxjs';
import {PINNED_ITEM_FALLBACK_COLOR} from '../constants/pinned-item.constants';
import {CaseMenuService} from './case-menu.service';

describe('CaseMenuService', () => {
  const buildService = (caseDefinitions: any[]): CaseMenuService =>
    new CaseMenuService(
      {registerAppendMenuItemsFunction: () => {}} as any,
      {getFeatureToggleObservable: () => of(true)} as any,
      {getCaseDefinitions: () => of(caseDefinitions)} as any,
      {pinnedItems$: of([])} as any,
      {} as any
    );

  it('adds the color of a case definition to its menu item in show-all mode', () => {
    const service = buildService([
      {caseDefinitionKey: 'house', name: 'House', color: '#ff0000'},
      {caseDefinitionKey: 'car', name: 'Car'},
    ]);

    const items: any[] = [];
    (service as any)
      .getCaseDefinitionMenuItems()
      .subscribe((menuItems: any[]) => items.push(...menuItems));
    expect(items.map(item => item.color)).toEqual([PINNED_ITEM_FALLBACK_COLOR, '#ff0000']);
  });
});
