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

import {ComponentFixture, TestBed} from '@angular/core/testing';
import {NoopAnimationsModule} from '@angular/platform-browser/animations';
import {TranslateModule} from '@ngx-translate/core';
import {DocumentService} from '@valtimo/document';
import {SearchFieldValues} from '@valtimo/shared';
import {of} from 'rxjs';
import {SearchFieldsComponent} from './search-fields.component';
import {SearchFieldsModule} from './search-fields.module';

describe('SearchFieldsComponent', () => {
  let fixture: ComponentFixture<SearchFieldsComponent>;
  let searches: SearchFieldValues[];
  let clears: number;

  const render = (inputs: {[input: string]: unknown}): void => {
    fixture = TestBed.createComponent(SearchFieldsComponent);
    Object.entries(inputs).forEach(([name, value]) => fixture.componentRef.setInput(name, value));
    fixture.componentInstance.doSearch.subscribe(values => searches.push(values));
    fixture.componentInstance.clearEvent.subscribe(() => clears++);
    fixture.detectChanges();
  };

  const switchCaseDefinition = (caseDefinitionKey: string): void => {
    fixture.componentRef.setInput('caseDefinitionKey', caseDefinitionKey);
    fixture.detectChanges();
  };

  beforeEach(() => {
    searches = [];
    clears = 0;

    TestBed.configureTestingModule({
      imports: [SearchFieldsModule, NoopAnimationsModule, TranslateModule.forRoot()],
      providers: [{provide: DocumentService, useValue: {getDropdownData: () => of(null)}}],
    });
  });

  afterEach(() => fixture.destroy());

  it('clears and searches again when the case definition changes, by default', () => {
    render({caseDefinitionKey: 'a'});
    searches = [];
    clears = 0;

    switchCaseDefinition('b');

    expect(clears).toBe(1);
    expect(searches).toEqual([{}]);
  });

  it('only resets its fields on a case definition change when asked not to emit the clear', () => {
    render({caseDefinitionKey: 'a', emitClearOnCaseDefinitionChange: false});
    fixture.componentInstance.values$.next({name: 'Jansen'});

    switchCaseDefinition('b');

    expect(clears).toBe(0);
    expect(searches).toEqual([]);
    expect(fixture.componentInstance.values$.getValue()).toEqual({});
  });

  it('keeps the values it was opened with when asked not to emit the clear', () => {
    render({
      caseDefinitionKey: 'a',
      defaultValues: {name: 'Jansen'},
      emitClearOnCaseDefinitionChange: false,
    });

    expect(clears).toBe(0);
    expect(searches).toEqual([{name: 'Jansen'}]);
    expect(fixture.componentInstance.values$.getValue()).toEqual({name: 'Jansen'});
  });
});
