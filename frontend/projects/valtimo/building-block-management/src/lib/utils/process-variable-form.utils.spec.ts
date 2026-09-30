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
import {ProcessVariablePatch} from '../models';
import {createProcessVariableGroup, serializeProcessVariables} from './process-variable-form.utils';

describe('process variable form utils', () => {
  const fb = new FormBuilder();

  const serialize = (...patches: ProcessVariablePatch[]): ProcessVariablePatch[] =>
    serializeProcessVariables(
      fb.array<FormGroup>(
        patches.map(patch => createProcessVariableGroup(fb, new Subscription(), patch))
      ) as FormArray
    );

  it('drops a row that names no target', () => {
    expect(
      serialize({target: '', source: 'doc:/naam'}, {target: 'pv:naam', source: 'doc:/naam'})
    ).toEqual([{target: 'pv:naam', source: 'doc:/naam'}]);
  });

  it('writes neither source nor value for a null row', () => {
    expect(serialize({target: 'pv:naam'})).toEqual([{target: 'pv:naam'}]);
  });

  it('keeps the target type on a path or value row only', () => {
    const variables = fb.array<FormGroup>([
      createProcessVariableGroup(fb, new Subscription(), {
        target: 'pv:leeftijd',
        value: '42',
        targetType: 'integer',
      }),
      createProcessVariableGroup(fb, new Subscription(), {target: 'pv:leeg'}),
    ]) as FormArray;
    // A null row keeps no type input, but a stale one from an earlier mode must not leak into the patch.
    (variables.at(1) as FormGroup).get('targetType')!.setValue('integer');

    expect(serializeProcessVariables(variables)).toEqual([
      {target: 'pv:leeftijd', value: '42', targetType: 'integer'},
      {target: 'pv:leeg'},
    ]);
  });
});
