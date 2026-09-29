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

import {FormArray, FormBuilder, FormGroup} from '@angular/forms';
import {of, throwError} from 'rxjs';
import {MigrationActivityMappingComponent} from './migration-activity-mapping.component';

describe('MigrationActivityMappingComponent', () => {
  let component: MigrationActivityMappingComponent;

  const FLOW_NODES = {
    sourceFlowNodeMap: {'task-a': 'Beoordelen'},
    targetFlowNodeMap: {'task-b': 'Beoordelen'},
  };

  const build = (processService: unknown): MigrationActivityMappingComponent => {
    const fb = new FormBuilder();
    const instance = new MigrationActivityMappingComponent(
      fb,
      {markForCheck: () => {}} as any,
      {registerAll: () => {}} as any,
      processService as any
    );
    instance.mappings = fb.array<FormGroup>([]) as FormArray;
    return instance;
  };

  const resolve = (suggest: boolean): void => {
    component.request = {
      sourceProcessDefinitionId: 'src:1:aaa',
      targetProcessDefinitionId: 'tgt:2:bbb',
      suggest,
    };
    component.ngOnChanges({request: {} as any});
  };

  beforeEach(() => {
    component = build({getFlowNodes: () => of(FLOW_NODES)});
  });

  it('offers each side only its own process activities', () => {
    resolve(false);

    expect(component.activities.sourceNodes.map(node => node.id)).toEqual(['task-a']);
    expect(component.activities.targetNodes.map(node => node.id)).toEqual(['task-b']);
  });

  // Name and id both, so activities sharing a title can be told apart.
  it('labels an activity with its name and its id', () => {
    resolve(false);

    expect(component.activities.sourceNodes[0].label).toBe('Beoordelen (task-a)');
  });

  // A restore must not overwrite the mapping the author saved.
  it('keeps the stored rows when the request does not ask for a suggestion', () => {
    component.api = {
      suggestActivityMapping: () => of({'task-a': 'task-b'}),
      validateActivityMapping: () => of({}),
    } as any;
    component.mappings.push(
      new FormBuilder().group({source: 'kept-a', target: 'kept-b'}) as FormGroup
    );

    resolve(false);

    expect(component.mappings.at(0).get('source')!.value).toBe('kept-a');
  });

  // The author picking another process is what asks for a fresh mapping.
  it('replaces the rows and announces it when the request asks for a suggestion', () => {
    component.api = {
      suggestActivityMapping: () => of({'task-a': 'task-b'}),
      validateActivityMapping: () => of({}),
    } as any;
    const announced = jasmine.createSpy('mappingsChange');
    component.mappingsChange.subscribe(announced);

    resolve(true);

    expect(component.mappings.length).toBe(1);
    expect(component.mappings.at(0).get('target')!.value).toBe('task-b');
    expect(announced).toHaveBeenCalled();
  });

  // null = "don't touch": a failed suggestion must not empty what the author has.
  it('leaves the rows alone when the suggestion fails', () => {
    component.api = {
      suggestActivityMapping: () => throwError(() => new Error('nope')),
      validateActivityMapping: () => of({}),
    } as any;
    component.mappings.push(
      new FormBuilder().group({source: 'kept-a', target: 'kept-b'}) as FormGroup
    );

    resolve(true);

    expect(component.mappings.length).toBe(1);
    expect(component.mappings.at(0).get('source')!.value).toBe('kept-a');
  });

  it('reports the engine refusal against the row that caused it', () => {
    component.api = {
      suggestActivityMapping: () => of(null),
      validateActivityMapping: () => of({'task-a': ['Not a valid migration']}),
    } as any;
    const row = new FormBuilder().group({source: 'task-a', target: 'task-b'}) as FormGroup;
    component.mappings.push(row);

    resolve(false);

    expect(component.errorsFor(row)).toEqual(['Not a valid migration']);
    expect(component.errorsFor(component.mappings.at(0))).toEqual(['Not a valid migration']);
  });

  // Neither side resolved means there is nothing to offer and nothing to judge.
  it('clears the activities and the refusals when a process is unset', () => {
    resolve(false);
    component.request = {
      sourceProcessDefinitionId: null,
      targetProcessDefinitionId: 'tgt:2:bbb',
      suggest: false,
    };
    component.ngOnChanges({request: {} as any});

    expect(component.activities).toEqual({sourceNodes: [], targetNodes: [], loading: false});
  });

  // A failed flow-node lookup still has to answer, or the row renders no dropdowns at all.
  it('falls back to empty activity lists when the lookup fails', () => {
    component = build({getFlowNodes: () => throwError(() => new Error('nope'))});

    resolve(false);

    expect(component.activities).toEqual({sourceNodes: [], targetNodes: [], loading: false});
  });
});
