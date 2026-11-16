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

import {BehaviorSubject, firstValueFrom, of} from 'rxjs';
import {GroupSearchFieldsComponent} from './group-search-fields.component';

describe('GroupSearchFieldsComponent', () => {
  const create = (fields: any[]): GroupSearchFieldsComponent => {
    const groupService = {getSearchFields: () => of(fields)};
    const translateService = {
      stream: () => of(''),
      instant: (key: string) => (key.endsWith('exact') ? 'Precies' : 'Bevat'),
    };
    const component = new GroupSearchFieldsComponent(
      {group$: new BehaviorSubject(null), currentGroup: {key: 'g'}} as any,
      groupService as any,
      translateService as any,
      {} as any,
      {registerAll: () => {}} as any,
      {} as any
    );
    (component as any)._fields$.next(fields);
    return component;
  };

  it('shows the translated effective match type of a text field', async () => {
    const component = create([
      {key: 'a', dataType: 'text', fieldType: 'single', matchType: null},
      {key: 'b', dataType: 'text', fieldType: 'single', matchType: 'like'},
    ]);

    const rows = await firstValueFrom(component.filteredFields$);

    expect(rows.map(row => row.matchType)).toEqual(['Precies', 'Bevat']);
  });

  it('shows no match type for a non text field', async () => {
    const component = create([
      {key: 'a', dataType: 'number', fieldType: 'single', matchType: null},
    ]);

    const rows = await firstValueFrom(component.filteredFields$);

    expect(rows[0].matchType).toBe('');
  });
});
