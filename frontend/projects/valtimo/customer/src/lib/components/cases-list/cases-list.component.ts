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

import {Component} from '@angular/core';
import {ActivatedRoute} from '@angular/router';
import {BehaviorSubject, Observable, of} from 'rxjs';
import {switchMap, tap} from 'rxjs/operators';
import {CustomerCase} from '../../models';
import {CustomerService} from '../../services/customer.service';
import {TableColumn} from '@valtimo/components';

/**
 * @deprecated Will be replace by new plugins
 */
@Component({
  selector: 'valtimo-cases-list',
  templateUrl: './cases-list.component.html',
  styleUrls: ['./cases-list.component.scss'],
})
export class CasesListComponent {
  readonly customerCases$: Observable<Array<CustomerCase>> = this.route.params.pipe(
    switchMap(params => (params?.bsn ? this.customerService.getCustomerCases(params.bsn) : of([]))),
    tap(() => this.loading$.next(false))
  );

  readonly loading$ = new BehaviorSubject<boolean>(true);

  readonly columns$ = new BehaviorSubject<Array<TableColumn>>([
    {
      labelTranslationKey: 'customerCases.labels.zaakNummer',
      dataKey: 'zaakNummer',
    },
    {
      labelTranslationKey: 'customerCases.labels.zaakStatus',
      dataKey: 'zaakStatus',
    },
    {
      labelTranslationKey: 'customerCases.labels.zaakType',
      dataKey: 'zaakType',
    },
  ]);

  constructor(
    private readonly route: ActivatedRoute,
    private readonly customerService: CustomerService
  ) {}
}
