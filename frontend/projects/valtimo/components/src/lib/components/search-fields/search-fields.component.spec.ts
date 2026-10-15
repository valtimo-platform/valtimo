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

import {DocumentService} from '@valtimo/document';
import {TranslateService} from '@ngx-translate/core';
import {IconService} from 'carbon-components-angular';
import {of} from 'rxjs';
import {SearchFieldsComponent} from './search-fields.component';

describe('SearchFieldsComponent', () => {
  let component: SearchFieldsComponent;
  let clearEvents: number;
  let searches: Array<object>;

  beforeEach(() => {
    component = new SearchFieldsComponent(
      jasmine.createSpyObj<DocumentService>('DocumentService', ['getDropdownData']),
      {stream: () => of(null), instant: (key: string) => key} as unknown as TranslateService,
      jasmine.createSpyObj<IconService>('IconService', ['registerAll'])
    );
    clearEvents = 0;
    searches = [];
    component.clearEvent.subscribe(() => clearEvents++);
    component.doSearch.subscribe(values => searches.push(values));
  });

  afterEach(() => component.ngOnDestroy());

  it('does not clear the external filters when the first case definition arrives', () => {
    component.caseDefinitionKey = 'bezwaar';
    component.ngOnInit();

    expect(clearEvents).toBe(0);
  });

  it('does not clear the external filters when the case definition arrives after init', () => {
    component.ngOnInit();
    component.caseDefinitionKey = 'bezwaar';

    expect(clearEvents).toBe(0);
  });

  it('clears the external filters when switching to another case definition', () => {
    component.caseDefinitionKey = 'bezwaar';
    component.ngOnInit();
    component.caseDefinitionKey = 'subsidie';

    expect(clearEvents).toBe(1);
    expect(searches[searches.length - 1]).toEqual({});
  });

  it('clears the external filters when the user clicks clear', () => {
    component.caseDefinitionKey = 'bezwaar';
    component.ngOnInit();
    component.clear();

    expect(clearEvents).toBe(1);
  });
});
