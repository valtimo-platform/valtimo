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

import {FormBuilder} from '@angular/forms';
import {of} from 'rxjs';
import {MigrationBuildingBlockTabComponent} from './migration-building-block-tab.component';
import {BuildingBlockEntryLookupService} from './building-block-entry-lookup.service';

describe('MigrationBuildingBlockTabComponent', () => {
  let component: MigrationBuildingBlockTabComponent;
  let lookup: BuildingBlockEntryLookupService;

  beforeEach(() => {
    lookup = new BuildingBlockEntryLookupService({
      getBuildingBlockDefinitions: () => of([{key: 'fotos', versionTag: '1.0.0'}]),
      getVersionsForBuildingBlock: () => of({content: []}),
      getProcessDefinitionsForBuildingBlock: () => of([]),
    } as any);

    component = new MigrationBuildingBlockTabComponent(
      new FormBuilder(),
      {markForCheck: () => {}} as any,
      {registerAll: () => {}} as any,
      lookup
    );
  });

  // The newest deployed version is the one the save path refuses when the target links an older one.
  it('starts a new add entry on the version the target links', () => {
    component.mode = 'add';
    component.api = {
      getLinkedBuildingBlocks: () => of([{key: 'fotos', versionTag: '1.0.0'}]),
      suggestBuildingBlockEntry: () => of({}),
    } as any;
    component.ngOnChanges({api: {} as any});
    component.addInstruction();
    const group = component.instructionsArray.at(0);

    group.get('buildingBlockKey')!.setValue('fotos');

    expect(group.get('buildingBlockVersionTag')!.value).toBe('1.0.0');
  });

  // A new [items] array re-renders every open key select, which can reset an open dropdown.
  it('keeps the key list reference when a per-entry lookup fills', () => {
    component.mode = 'remove';
    component.planSource = {versionTag: '1.0.0'};
    component.api = {
      getLinkedBuildingBlocks: () => of([{key: 'fotos', versionTag: '1.0.0'}]),
    } as any;
    component.ngOnChanges({planSource: {} as any});
    component.ngOnInit();
    const keyItems = component.keyItems;

    lookup.ensureVersionItems('fotos');

    expect(component.keyItems.map(item => item.id)).toEqual(['fotos']);
    expect(component.keyItems).toBe(keyItems);
  });

  // The instructions echo back on every keystroke; a new context each time would re-render every open card.
  it('rebuilds the entry context on an input change and keeps it on an instructions change', () => {
    component.ngOnChanges({mode: {} as any});
    const context = component.entryContext;

    component.ngOnChanges({instructions: {} as any});
    expect(component.entryContext).toBe(context);

    component.mode = 'remove';
    component.ngOnChanges({mode: {} as any});
    expect(component.entryContext).not.toBe(context);
    expect(component.entryContext.mode).toBe('remove');
  });
});
