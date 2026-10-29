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
import {Subscription} from 'rxjs';
import {MigrationProcessVariablesComponent} from './migration-process-variables.component';

describe('MigrationProcessVariablesComponent', () => {
  let component: MigrationProcessVariablesComponent;

  const row = (index: number): FormGroup => component.variables.at(index) as FormGroup;

  beforeEach(() => {
    const fb = new FormBuilder();
    component = new MigrationProcessVariablesComponent(fb, {registerAll: () => {}} as any);
    component.variables = fb.array<FormGroup>([]) as FormArray;
    component.subscriptions = new Subscription();
  });

  it('appends a new row in path mode', () => {
    component.addVariable();

    expect(component.variables.length).toBe(1);
    expect(row(0).get('mode')!.value).toBe('path');
  });

  it('clears the source when a row switches to a fixed value', () => {
    component.addVariable();
    row(0).patchValue({source: 'doc:/naam', target: 'pv:naam'});

    row(0).get('mode')!.setValue('value');

    expect(row(0).get('source')!.value).toBe('');
  });

  it('clears both source and value when a row switches to null', () => {
    component.addVariable();
    row(0).patchValue({source: 'doc:/naam', value: 'x', target: 'pv:naam'});

    row(0).get('mode')!.setValue('null');

    expect(row(0).get('source')!.value).toBe('');
    expect(row(0).get('value')!.value).toBe('');
  });

  it('removes the row at the given index', () => {
    component.addVariable();
    component.addVariable();
    row(0).get('target')!.setValue('pv:first');
    row(1).get('target')!.setValue('pv:second');

    component.removeVariable(0);

    expect(component.variables.length).toBe(1);
    expect(row(0).get('target')!.value).toBe('pv:second');
  });
});
