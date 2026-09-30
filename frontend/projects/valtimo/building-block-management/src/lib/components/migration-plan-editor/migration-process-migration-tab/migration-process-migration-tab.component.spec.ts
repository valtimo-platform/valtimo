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
import {MigrationProcessMigrationTabComponent} from './migration-process-migration-tab.component';

describe('MigrationProcessMigrationTabComponent', () => {
  let component: MigrationProcessMigrationTabComponent;

  const firstInstruction = (): FormGroup => {
    component.addInstruction();
    return component.instructionsArray.at(0) as FormGroup;
  };

  beforeEach(() => {
    component = new MigrationProcessMigrationTabComponent(
      new FormBuilder(),
      {markForCheck: () => {}} as any,
      {registerAll: () => {}} as any,
      {getFlowNodes: () => of({sourceFlowNodeMap: {}, targetFlowNodeMap: {}})} as any
    );
  });

  // A building-block entry hands the owner's process to the block, so the owner's key is never a target.
  it('leaves the target empty when the target side does not offer the source key', () => {
    component.sourceProcessDefinitions = {main: 'main:1:aaa'};
    component.targetProcessDefinitions = {sub: 'sub:1:bbb'};
    const group = firstInstruction();

    group.get('sourceProcessDefinitionKey')!.setValue('main');

    expect(group.get('targetProcessDefinitionKey')!.value).toBe('');
    expect(component.processKeyOptions(group, 'target')).toEqual(['sub']);
  });

  // Both sides are the same blueprint at two versions — migrating a process onto itself is the common case.
  it('mirrors a source both sides offer onto an empty target', () => {
    component.sourceProcessDefinitions = {main: 'main:1:aaa'};
    component.targetProcessDefinitions = {main: 'main:2:ccc'};
    const group = firstInstruction();

    group.get('sourceProcessDefinitionKey')!.setValue('main');

    expect(group.get('targetProcessDefinitionKey')!.value).toBe('main');
  });

  // No scope means every deployed process, so anything the source offers is a target too.
  it('mirrors when the target side is unscoped', () => {
    const group = firstInstruction();

    group.get('sourceProcessDefinitionKey')!.setValue('main');

    expect(group.get('targetProcessDefinitionKey')!.value).toBe('main');
  });

  describe('suggested activity mapping', () => {
    const pickedInstruction = (): FormGroup => {
      component.sourceProcessDefinitions = {main: 'main:1:aaa'};
      component.targetProcessDefinitions = {main: 'main:2:ccc'};
      const group = firstInstruction();
      group.get('sourceProcessDefinitionKey')!.setValue('main');
      return group;
    };

    const addRow = (group: FormGroup): void => {
      component
        .mapActivitiesArray(group)
        .push(new FormBuilder().group({source: 'task-a', target: 'task-b'}));
    };

    it('owes a suggestion once the author picks a process', () => {
      expect(component.isSuggestPending(pickedInstruction())).toBeTrue();
    });

    // Spending the suggestion must not reload the child, or every suggestion resolves twice.
    it('spends an applied suggestion without handing the child a new request', () => {
      const group = pickedInstruction();
      const request = component.mappingRequestFor(group);

      component.onSuggestSettled(group, true);

      expect(component.isSuggestPending(group)).toBeFalse();
      expect(component.mappingRequestFor(group)).toBe(request);
    });

    // Nothing to overwrite yet, so the next expand may try again.
    it('keeps a failed suggestion owed while there are no rows', () => {
      const group = pickedInstruction();

      component.onSuggestSettled(group, false);

      expect(component.isSuggestPending(group)).toBeTrue();
    });

    it('drops a failed suggestion when there are rows it would overwrite', () => {
      const group = pickedInstruction();
      addRow(group);

      component.onSuggestSettled(group, false);

      expect(component.isSuggestPending(group)).toBeFalse();
    });

    // The author typing rows after a failed try: a retry on the next expand would wipe them.
    it('drops an owed suggestion as soon as the author edits the rows', () => {
      const group = pickedInstruction();
      component.onSuggestSettled(group, false);

      addRow(group);

      expect(component.isSuggestPending(group)).toBeFalse();
    });

    // The scoping maps re-arriving with the same ids must not reload every card.
    it('keeps the request reference when the resolved ids did not change', () => {
      const group = pickedInstruction();
      const request = component.mappingRequestFor(group);

      component.targetProcessDefinitions = {main: 'main:2:ccc'};
      component.ngOnChanges({targetProcessDefinitions: {} as any});

      expect(component.mappingRequestFor(group)).toBe(request);
    });
  });
});
