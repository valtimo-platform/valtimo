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

import {Component, OnDestroy, OnInit, ViewEncapsulation} from '@angular/core';
import {ActivatedRoute, ParamMap} from '@angular/router';
import {Document, DocumentService} from '@valtimo/document';
import {FormService} from '@valtimo/form';
import {FormioOptionsImpl, ValtimoFormioOptions} from '@valtimo/components';
import moment from 'moment';
import {FormioForm} from '@formio/angular';
import {BehaviorSubject, combineLatest, map, Observable, of, Subscription, tap} from 'rxjs';
import {NotificationContent} from 'carbon-components-angular';
import {TranslateService} from '@ngx-translate/core';
import {catchError} from 'rxjs/operators';

moment.locale(localStorage.getItem('langKey') || '');
moment.defaultFormat = 'DD MMM YYYY HH:mm';

@Component({
  standalone: false,
  templateUrl: './summary.component.html',
  styleUrls: ['./summary.component.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class CaseDetailTabSummaryComponent implements OnInit, OnDestroy {
  public readonly caseDefinitionKey: string;
  public readonly documentId!: string;

  public document!: Document;
  private snapshot: ParamMap;
  public moment!: typeof moment;
  public formDefinition: FormioForm = null;

  public readonly loading$ = new BehaviorSubject<boolean>(true);

  public options: ValtimoFormioOptions;

  public notificationObj$: Observable<NotificationContent> | null = null;

  private _subscriptions = new Subscription();

  constructor(
    private readonly documentService: DocumentService,
    private readonly route: ActivatedRoute,
    private readonly formService: FormService,
    private readonly translateService: TranslateService
  ) {
    this.snapshot = this.route.snapshot.paramMap;
    this.caseDefinitionKey = this.snapshot.get('caseDefinitionKey') || '';
    this.documentId = this.snapshot.get('documentId') || '';
    this.options = new FormioOptionsImpl();
    this.options.disableAlerts = true;
  }

  public ngOnInit(): void {
    this.moment = moment;
    this.init();
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  public init(): void {
    this._subscriptions.add(
      combineLatest([
        this.documentService.getDocument(this.documentId).pipe(catchError(() => of(null))),
        this.formService
          .getFormDefinitionByNamePreFilled(`${this.caseDefinitionKey}.summary`, this.documentId)
          .pipe(catchError(() => of(null))),
      ])
        .pipe(
          tap(([document, formDefinition]) => {
            this.document = document;
            this.formDefinition = formDefinition;

            if (!formDefinition || !document) {
              this.notificationObj$ = combineLatest([
                this.translateService.stream('interface.warning'),
                this.translateService.stream('case.summaryFormNotFound', {
                  summary: this.caseDefinitionKey,
                }),
              ]).pipe(
                map(([title, message]) => ({
                  type: 'warning',
                  title,
                  message,
                  showClose: false,
                  lowContrast: true,
                }))
              );
            }

            this.loading$.next(false);
          })
        )
        .subscribe()
    );
  }
}
