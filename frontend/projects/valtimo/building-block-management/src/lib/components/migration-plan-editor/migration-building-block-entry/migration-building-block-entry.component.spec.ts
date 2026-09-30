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

import {FormBuilder, FormGroup} from '@angular/forms';
import {of} from 'rxjs';
import {BuildingBlockEntryLookupService} from '../migration-building-block-tab/building-block-entry-lookup.service';
import {
  BuildingBlockEntryContext,
  MigrationBuildingBlockEntryComponent,
} from './migration-building-block-entry.component';

describe('MigrationBuildingBlockEntryComponent', () => {
  let component: MigrationBuildingBlockEntryComponent;
  let lookup: BuildingBlockEntryLookupService;
  let group: FormGroup;

  // The case still runs 'aanvraag-behandelen' — the target version handed it to the block, so it links only 'aanvraag-start'.
  const SOURCE_DEFS = {
    'aanvraag-start': 'aanvraag-start:1:aaa',
    'aanvraag-behandelen': 'aanvraag-behandelen:1:bbb',
  };
  const TARGET_DEFS = {
    'aanvraag-start': 'aanvraag-start:2:ccc',
    'aanvraag-afronden': 'aanvraag-afronden:1:ddd',
  };

  const withContext = (context: Partial<BuildingBlockEntryContext>): void => {
    component.context = {
      mode: 'add',
      api: null,
      owner: null,
      ownerProcessDefinitions: TARGET_DEFS,
      ownerSourceProcessDefinitions: SOURCE_DEFS,
      planSource: null,
      dataMigrationHintKey: null,
      processMigrationHintKey: null,
      sourcePrefixes: [],
      testIds: {} as any,
      ...context,
    };
  };

  beforeEach(() => {
    lookup = new BuildingBlockEntryLookupService({
      getBuildingBlockDefinitions: () => of([{key: 'fotos', versionTag: '1.0.0'}]),
      getVersionsForBuildingBlock: () => of({content: []}),
      getProcessDefinitionsForBuildingBlock: () => of([]),
    } as any);

    const fb = new FormBuilder();
    group = fb.group({
      buildingBlockKey: fb.control(''),
      buildingBlockVersionTag: fb.control(''),
    });

    component = new MigrationBuildingBlockEntryComponent(lookup, {markForCheck: () => {}} as any);
    component.group = group;
  });

  it('offers an add entry the source version processes only — the target version adds none it can hijack', () => {
    withContext({mode: 'add'});

    expect(Object.keys(component.sourceProcessDefinitions())).toEqual(
      jasmine.arrayWithExactContents(['aanvraag-start', 'aanvraag-behandelen'])
    );
  });

  // The version the instances still have — the same end AddBuildingBlockProcessChecker resolves.
  it('resolves a process both versions link against the source version', () => {
    withContext({mode: 'add'});

    expect(component.sourceProcessDefinitions()['aanvraag-start']).toBe(
      SOURCE_DEFS['aanvraag-start']
    );
  });

  it('hands a removed block its process back at the target version only', () => {
    withContext({mode: 'remove'});

    // Source is the block's own map — empty until an entry names a block — never the owner's.
    expect(component.sourceProcessDefinitions()).toEqual({});
    expect(component.targetProcessDefinitions()).toEqual(TARGET_DEFS);
  });

  // A remove entry's owner is read off the plan's source tree, so this plan's own block comes back at the source version — while what the entry hands back lands on the target's.
  it('keeps a remove entry on the target version when the owner is this plan own block', () => {
    withContext({
      mode: 'remove',
      owner: {type: 'BUILDING_BLOCK', key: 'inspectie', versionTag: '1.0.6'},
    });
    group.get('buildingBlockKey')!.setValue('dossier');
    group.get('buildingBlockVersionTag')!.setValue('1.0.0');
    lookup.rememberEntryOwner('dossier', '1.0.0', {
      type: 'BUILDING_BLOCK',
      key: 'inspectie',
      versionTag: '1.0.5',
    });

    expect(component.targetProcessDefinitions()).toEqual(TARGET_DEFS);
    expect(component.targetContext()).toEqual({
      buildingBlockKey: 'inspectie',
      buildingBlockVersionTag: '1.0.6',
    });
  });

  // A new object per call would re-trigger the nested tab's ngOnChanges on every change detection.
  it('keeps one reference for the running-process map', () => {
    withContext({mode: 'add'});

    expect(component.sourceProcessDefinitions()).toBe(component.sourceProcessDefinitions());
  });
});
