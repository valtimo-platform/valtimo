/*
 * Copyright 2015-2024 Ritense BV, the Netherlands.
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

import {TestBed} from '@angular/core/testing';
import {CaseTag, CaseTagService} from '@valtimo/document';
import {BehaviorSubject, of} from 'rxjs';
import {DossierListCaseTagService} from './dossier-list-case-tag.service';
import {DossierListService} from './dossier-list.service';
import {DossierParameterService} from './dossier-parameter.service';

describe('DossierListCaseTagService', () => {
  const trainingTag = {key: 'training-bijna-vol', title: 'Training bijna vol'} as CaseTag;
  const tagsPerDefinition: {[name: string]: CaseTag[]} = {
    trainingsbeheer: [trainingTag],
    'algemene-bijstand': [],
  };

  let documentDefinitionName$: BehaviorSubject<string>;
  let queryCaseTagsParams$: BehaviorSubject<string[] | null>;
  let setCaseTagParameter: jasmine.Spy;
  let service: DossierListCaseTagService;

  beforeEach(() => {
    documentDefinitionName$ = new BehaviorSubject<string>('trainingsbeheer');
    queryCaseTagsParams$ = new BehaviorSubject<string[] | null>(['training-bijna-vol']);
    setCaseTagParameter = jasmine.createSpy('setCaseTagParameter');

    TestBed.configureTestingModule({
      providers: [
        DossierListCaseTagService,
        {provide: DossierListService, useValue: {documentDefinitionName$}},
        {
          provide: CaseTagService,
          useValue: {getCaseTags: (name: string) => of(tagsPerDefinition[name] ?? [])},
        },
        {provide: DossierParameterService, useValue: {queryCaseTagsParams$, setCaseTagParameter}},
      ],
    });
    service = TestBed.inject(DossierListCaseTagService);
  });

  it('selects the case tags from the URL parameter on first load', () => {
    let selected: CaseTag[] = [];
    service.selectedCaseTags$.subscribe(tags => (selected = tags));
    service.caseTags$.subscribe();

    expect(selected).toEqual([trainingTag]);
  });

  it('clears the selected case tags when switching to a case type without case tag parameters', () => {
    let selected: CaseTag[] = [];
    service.selectedCaseTags$.subscribe(tags => (selected = tags));
    service.caseTags$.subscribe();
    expect(selected).toEqual([trainingTag]);

    queryCaseTagsParams$.next(null);
    documentDefinitionName$.next('algemene-bijstand');

    expect(selected).toEqual([]);
  });
});
