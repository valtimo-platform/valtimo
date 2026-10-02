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
import {PatchMode, ProcessVariablePatch} from '../models';

/** One `setProcessVariables` row. Its mode subscription goes into [subscriptions], which must outlive the row. */
export function createProcessVariableGroup(
  fb: FormBuilder,
  subscriptions: Subscription,
  patch?: ProcessVariablePatch
): FormGroup {
  const group = fb.group({
    mode: fb.control<PatchMode>(modeOf(patch)),
    source: fb.control(patch?.source ?? ''),
    value: fb.control(patch?.value != null ? String(patch.value) : ''),
    target: fb.control(patch?.target ?? ''),
    targetType: fb.control(patch?.targetType ?? ''),
  });

  // Clear the now-irrelevant input(s) when the mode switches, so the serialized patch stays clean.
  subscriptions.add(
    group.get('mode')!.valueChanges.subscribe(mode => {
      if (mode !== 'path') group.get('source')!.setValue('', {emitEvent: false});
      if (mode !== 'value') group.get('value')!.setValue('', {emitEvent: false});
    })
  );

  return group;
}

export function serializeProcessVariables(variables: FormArray): ProcessVariablePatch[] {
  return variables.controls
    .map(row => {
      const {mode, source, value, target, targetType} = (row as FormGroup).getRawValue();
      const patch: ProcessVariablePatch = {target: target ?? ''};
      // 'null' writes neither key: that is the clear shape, and the only one a save keeps.
      if (mode === 'path') {
        if (source) patch.source = source;
      } else if (mode === 'value' && value !== '' && value != null) patch.value = value;
      if (mode !== 'null' && targetType) patch.targetType = targetType;
      return patch;
    })
    .filter(patch => !!patch.target);
}

/** Derive the edit mode from a stored patch. No source and no value clears the target, so it is 'null'; only a brand-new patch defaults to 'path'. */
function modeOf(patch?: ProcessVariablePatch): PatchMode {
  if (!patch) return 'path';
  if (patch.source) return 'path';
  if (patch.value !== undefined && patch.value !== null) return 'value';
  return 'null';
}
