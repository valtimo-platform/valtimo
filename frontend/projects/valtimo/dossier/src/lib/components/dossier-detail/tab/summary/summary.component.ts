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

import {Component, OnDestroy, OnInit, ViewEncapsulation} from '@angular/core';
import {ActivatedRoute, ParamMap} from '@angular/router';
import {Document, DocumentService} from '@valtimo/document';
import {FormService} from '@valtimo/form';
import {FormioOptionsImpl, ValtimoFormioOptions} from '@valtimo/components';
import moment from 'moment';
import {FormioForm} from '@formio/angular';
import {Subscription} from 'rxjs';

moment.locale(localStorage.getItem('langKey') || '');
moment.defaultFormat = 'DD MMM YYYY HH:mm';

@Component({
  selector: 'valtimo-dossier-detail-tab-summary',
  templateUrl: './summary.component.html',
  styleUrls: ['./summary.component.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class DossierDetailTabSummaryComponent implements OnInit, OnDestroy {
  public readonly documentDefinitionName: string;
  public readonly documentId!: string;

  public document!: Document;
  private snapshot: ParamMap;
  public moment!: typeof moment;
  public formDefinition: FormioForm = null;
  public options: ValtimoFormioOptions;
  private _subscriptions = new Subscription();

  constructor(
    private readonly documentService: DocumentService,
    private readonly route: ActivatedRoute,
    private readonly formService: FormService
  ) {
    this.snapshot = this.route.snapshot.paramMap;
    this.documentDefinitionName = this.snapshot.get('documentDefinitionName') || '';
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
      this.documentService.getDocument(this.documentId).subscribe(document => {
        this.document = document;
      })
    );

    this._subscriptions.add(
      this.formService
        .getFormDefinitionByNamePreFilled(`${this.documentDefinitionName}.summary`, this.documentId)
        .subscribe(formDefinition => {
          this.formDefinition = formDefinition;
        })
    );
  }
}
