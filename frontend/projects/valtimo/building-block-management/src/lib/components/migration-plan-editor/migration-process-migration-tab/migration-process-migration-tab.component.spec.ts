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
});
