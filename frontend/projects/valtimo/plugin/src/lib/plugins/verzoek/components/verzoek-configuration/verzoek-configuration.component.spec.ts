/*
 * Copyright 2015-2025 Ritense BV, the Netherlands.
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

import {of} from 'rxjs';
import {SelectItem} from '@valtimo/components';
import {CaseListItem} from '../../models';
import {VerzoekConfigurationComponent} from './verzoek-configuration.component';

describe('VerzoekConfigurationComponent', () => {
  const BACKEND_DEFAULT_PAGE_SIZE = 20;
  const CASE_DEFINITIONS = Array.from(
    {length: 27},
    (_, index) => ({caseDefinitionKey: `case-${index + 1}`}) as CaseListItem
  );

  let component: VerzoekConfigurationComponent;

  beforeEach(() => {
    const verzoekPluginService = jasmine.createSpyObj('VerzoekPluginService', {
      getAllObjects: of([]),
      getCaseDefinitions: of(null),
    });
    verzoekPluginService.getCaseDefinitions.and.callFake((params: {size?: number}) => {
      const size = params?.size ?? BACKEND_DEFAULT_PAGE_SIZE;
      return of({
        content: CASE_DEFINITIONS.slice(0, size),
        totalElements: CASE_DEFINITIONS.length,
      });
    });

    component = new VerzoekConfigurationComponent(
      jasmine.createSpyObj('PluginManagementService', {
        getPluginConfigurationsByPluginDefinitionKey: of([]),
      }),
      jasmine.createSpyObj('TranslateService', {stream: of('key')}),
      jasmine.createSpyObj('PluginTranslationService', {instant: 'title'}),
      verzoekPluginService,
      jasmine.createSpyObj('ProcessService', {getProcessDefinitions: of([])}),
      jasmine.createSpyObj('ModalService', ['openModal']),
      jasmine.createSpyObj('IconService', ['registerAll'])
    );
  });

  it('GH-777 offers every case definition, not only the first page of 20', () => {
    let items: Array<SelectItem> = [];

    component.caseSelectItems$.subscribe(caseSelectItems => (items = caseSelectItems));

    expect(items.length).toBe(27);
    expect(items[26].id).toBe('case-27');
  });
});
