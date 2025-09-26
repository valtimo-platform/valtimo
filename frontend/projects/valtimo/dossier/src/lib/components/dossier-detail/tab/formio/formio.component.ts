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

import {ChangeDetectionStrategy, Component} from '@angular/core';
import {DossierTabService} from '../../../../services';
import {ActivatedRoute} from '@angular/router';
import {FormService} from '@valtimo/form';
import {BehaviorSubject, combineLatest, Observable, of, switchMap, tap} from 'rxjs';
import {FormioForm} from '@formio/angular';
import {catchError} from 'rxjs/operators';

@Component({
  templateUrl: './formio.component.html',
  styleUrls: ['./formio.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DossierDetailTabFormioComponent {
  public readonly loading$ = new BehaviorSubject<boolean>(true);
  public readonly formNotFound$ = new BehaviorSubject<string>('');
  public readonly noFormSpecified$ = new BehaviorSubject<boolean>(false);
  private _formDefinitionName!: string;
  public readonly prefilledForm$: Observable<FormioForm | null> = combineLatest([
    this.tabService.tabs$,
    this.route.params,
  ]).pipe(
    switchMap(([tabs, params]) => {
      const currentTabName = params?.tab;
      const documentId = params?.documentId;
      const currentTab = tabs.find(tab => tab.name === currentTabName);

      if (!documentId || !currentTab?.contentKey) {
        this.noFormSpecified$.next(true);
        return of(null);
      }

      this._formDefinitionName = currentTab.contentKey;
      return this.formService.getFormDefinitionByNamePreFilled(currentTab.contentKey, documentId);
    }),
    tap(() => this.loading$.next(false)),
    catchError(() => {
      this.formNotFound$.next(this._formDefinitionName);
      this.loading$.next(false);
      return of(null);
    })
  );

  constructor(
    private readonly tabService: DossierTabService,
    private readonly route: ActivatedRoute,
    private readonly formService: FormService
  ) {}
}
