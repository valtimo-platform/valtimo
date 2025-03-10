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

import {Injectable} from '@angular/core';
import {DossierListService} from './dossier-list.service';
import {InternalCaseStatus, CaseTagService} from '@valtimo/document';
import {DossierParameterService} from './dossier-parameter.service';
import {BehaviorSubject, combineLatest, map, Observable, of, switchMap, take, tap} from 'rxjs';

@Injectable()
export class DossierListCaseTagService {
  private readonly _selectedCaseTags$ = new BehaviorSubject<InternalCaseStatus[]>([]);

  private readonly _showCaseTagsSelector$ = new BehaviorSubject<boolean>(false);

  private readonly _caseTags$: Observable<Array<InternalCaseStatus>> =
    this.dossierListService.documentDefinitionName$.pipe(
      switchMap(documentDefinitionName =>
        combineLatest([
          this.caseTagsService.getCaseTags(documentDefinitionName),
          this.dossierParameterService.queryCaseTagsParams$,
        ]).pipe(take(1))
      ),
      tap(([caseTags, queryCaseTags]) => {
        const selectedCaseTags = queryCaseTags
          ? caseTags.filter(caseTag => queryCaseTags.includes(caseTag.key))
          : [...caseTags.filter(caseTag => caseTag.visibleInCaseListByDefault)];
        this.setSelectedCaseTags(selectedCaseTags);
      }),
      map(([caseTags]) => caseTags),
      tap(caseTags => this._showCaseTagsSelector$.next((caseTags || []).length > 1))
    );

  public get caseTags$(): Observable<Array<InternalCaseStatus>> {
    return this._caseTags$;
  }

  public get showCaseTagsSelector$(): Observable<boolean> {
    return this._showCaseTagsSelector$.asObservable();
  }

  public get selectedCaseTags$(): Observable<Array<InternalCaseStatus>> {
    return this._selectedCaseTags$;
  }

  constructor(
    private readonly dossierListService: DossierListService,
    private readonly caseTagsService: CaseTagService,
    private readonly dossierParameterService: DossierParameterService
  ) {}

  public setSelectedCaseTags(caseTags: InternalCaseStatus[]): void {
    this._selectedCaseTags$.next(caseTags);
    this.dossierParameterService.setCaseTagParameter(caseTags.map(caseTag => caseTag.key));
  }
}
