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

import {firstValueFrom, of} from 'rxjs';
import {toArray} from 'rxjs/operators';
import {ActionItem} from '../../models';
import {ActionItemHiddenPipe} from './action-item-hidden.pipe';

describe('ActionItemHiddenPipe', () => {
  let pipe: ActionItemHiddenPipe;

  beforeEach(() => {
    pipe = new ActionItemHiddenPipe();
  });

  const baseAction: ActionItem = {
    label: 'some.label',
    callback: () => {},
  };

  it('emits false when the action has no hidden$', async () => {
    const result = await firstValueFrom(pipe.transform(baseAction, {}));

    expect(result).toBe(false);
  });

  it('starts with true (hidden) while the check is pending, then emits the resolved value', async () => {
    const action: ActionItem = {
      ...baseAction,
      hidden$: () => of(false),
    };

    const emissions = await firstValueFrom(pipe.transform(action, {}).pipe(toArray()));

    expect(emissions).toEqual([true, false]);
  });

  it('passes the row item through to hidden$', () => {
    const item = {fileId: 'some-id'};
    const hidden$ = jasmine.createSpy('hidden$').and.returnValue(of(true));
    const action: ActionItem = {...baseAction, hidden$};

    pipe.transform(action, item);

    expect(hidden$).toHaveBeenCalledWith(item);
  });
});
