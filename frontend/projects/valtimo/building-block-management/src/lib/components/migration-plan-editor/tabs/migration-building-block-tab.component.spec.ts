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
import {MigrationBuildingBlockTabComponent} from './migration-building-block-tab.component';

describe('MigrationBuildingBlockTabComponent', () => {
  let component: MigrationBuildingBlockTabComponent;

  // The case still runs 'aanvraag-behandelen' — the target version handed it to the block, so it links only 'aanvraag-start'.
  const SOURCE_DEFS = {
    'aanvraag-start': 'aanvraag-start:1:aaa',
    'aanvraag-behandelen': 'aanvraag-behandelen:1:bbb',
  };
  const TARGET_DEFS = {
    'aanvraag-start': 'aanvraag-start:2:ccc',
    'aanvraag-afronden': 'aanvraag-afronden:1:ddd',
  };

  const firstInstruction = (): FormGroup => {
    component.addInstruction();
    return component.instructionsArray.at(0) as FormGroup;
  };

  beforeEach(() => {
    component = new MigrationBuildingBlockTabComponent(
      new FormBuilder(),
      {markForCheck: () => {}} as any,
      {registerAll: () => {}} as any,
      {} as any
    );
    component.ownerProcessDefinitions = TARGET_DEFS;
    component.ownerSourceProcessDefinitions = SOURCE_DEFS;
  });

  it('offers an add entry the source version processes only — the target version adds none it can hijack', () => {
    component.mode = 'add';

    expect(Object.keys(component.sourceProcessDefinitionsOf(firstInstruction()))).toEqual(
      jasmine.arrayWithExactContents(['aanvraag-start', 'aanvraag-behandelen'])
    );
  });

  // The version the instances still have — the same end AddBuildingBlockProcessChecker resolves.
  it('resolves a process both versions link against the source version', () => {
    component.mode = 'add';

    expect(component.sourceProcessDefinitionsOf(firstInstruction())['aanvraag-start']).toBe(
      SOURCE_DEFS['aanvraag-start']
    );
  });

  it('hands a removed block its process back at the target version only', () => {
    component.mode = 'remove';
    const group = firstInstruction();

    // Source is the block's own map — empty until an entry names a block — never the owner's.
    expect(component.sourceProcessDefinitionsOf(group)).toEqual({});
    expect(component.targetProcessDefinitionsOf(group)).toEqual(TARGET_DEFS);
  });

  // A new object per call would re-trigger the nested tab's ngOnChanges on every change detection.
  it('keeps one reference for the running-process map', () => {
    component.mode = 'add';
    const group = firstInstruction();

    expect(component.sourceProcessDefinitionsOf(group)).toBe(
      component.sourceProcessDefinitionsOf(group)
    );
  });
});
