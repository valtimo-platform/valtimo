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

import {TestBed} from '@angular/core/testing';
import {EMPTY, of} from 'rxjs';
import {CASE_OVERVIEW_PIN_CLICK_GUARD_MS} from '../../constants';
import {PinnedItemType} from '../../models';
import {CaseOverviewComponent} from './case-overview.component';

describe('CaseOverviewComponent', () => {
  let component: CaseOverviewComponent;
  let pinnedItemsService: jasmine.SpyObj<any>;
  let now: number;

  beforeEach(() => {
    now = 1_000_000;
    spyOn(Date, 'now').and.callFake(() => now);

    pinnedItemsService = jasmine.createSpyObj('PinnedItemsService', ['togglePinnedItem'], {
      pinnedItems$: of([]),
      pinnedItemKeys$: of(''),
    });
    pinnedItemsService.togglePinnedItem.and.returnValue(EMPTY);

    const configService = {
      config: {featureToggles: {}},
      getFeatureToggleObservable: () => of(false),
    };
    const documentService = {
      getCaseDefinitionGroups: () => of([]),
      getCaseDefinitions: () => of([]),
    };

    component = TestBed.runInInjectionContext(
      () =>
        new CaseOverviewComponent(
          configService as any,
          documentService as any,
          {registerAll: () => {}} as any,
          {showToast: () => null, close: () => {}} as any,
          pinnedItemsService,
          {instant: (key: string) => key, stream: () => of('')} as any
        )
    );
  });

  it('ignores a second pin click within the double-click window', () => {
    component.onTogglePin(PinnedItemType.CASE_DEFINITION_GROUP, 'group-a', 'Group A');
    now += CASE_OVERVIEW_PIN_CLICK_GUARD_MS - 1;
    component.onTogglePin(PinnedItemType.CASE_DEFINITION_GROUP, 'group-b', 'Group B');

    expect(pinnedItemsService.togglePinnedItem).toHaveBeenCalledTimes(1);
    expect(pinnedItemsService.togglePinnedItem.calls.mostRecent().args[1]).toBe('group-a');
  });

  it('accepts a pin click after the double-click window', () => {
    component.onTogglePin(PinnedItemType.CASE_DEFINITION_GROUP, 'group-a', 'Group A');
    now += CASE_OVERVIEW_PIN_CLICK_GUARD_MS;
    component.onTogglePin(PinnedItemType.CASE_DEFINITION_GROUP, 'group-b', 'Group B');

    expect(pinnedItemsService.togglePinnedItem).toHaveBeenCalledTimes(2);
  });
});
