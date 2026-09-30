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
import {DataMigrationPatch} from '../../../models';
import {MigrationDataMigrationTabComponent} from './migration-data-migration-tab.component';

describe('MigrationDataMigrationTabComponent', () => {
  let component: MigrationDataMigrationTabComponent;

  const modeAt = (index: number): string =>
    component.patchesArray.at(index).get('mode')!.value as string;

  beforeEach(() => {
    component = new MigrationDataMigrationTabComponent(new FormBuilder(), {
      registerAll: () => {},
    } as any);
  });

  // The shape every saved and every file-deployed clear has — `NON_NULL` strips the marker.
  it('reads a patch with neither source nor value as a clear', () => {
    component.patches = [{target: 'doc:/nieuwAdres'}];

    expect(modeAt(0)).toBe('null');
  });

  it('still reads an explicit null value as a clear', () => {
    component.patches = [{target: 'doc:/nieuwAdres', value: null}];

    expect(modeAt(0)).toBe('null');
  });

  it('reads a patch with a source as a copy', () => {
    component.patches = [{source: 'doc:/adres', target: 'doc:/nieuwAdres'}];

    expect(modeAt(0)).toBe('path');
  });

  it('reads a patch with a literal value as a value', () => {
    component.patches = [{target: 'doc:/status', value: 'gemigreerd'}];

    expect(modeAt(0)).toBe('value');
  });

  it('defaults a patch added by hand to a copy', () => {
    component.addPatch();

    expect(modeAt(0)).toBe('path');
  });

  it('writes a clear back out unchanged, so opening a plan cannot rewrite it', () => {
    let emitted: DataMigrationPatch[] = [];
    component.ngOnInit();
    component.patchesChange.subscribe(patches => (emitted = patches));
    component.patches = [{target: 'doc:/nieuwAdres'}];

    // Any edit flushes the whole array; the untouched clear must come back as it went in.
    component.addPatch();

    expect(emitted[0]).toEqual({target: 'doc:/nieuwAdres'});
  });
});
