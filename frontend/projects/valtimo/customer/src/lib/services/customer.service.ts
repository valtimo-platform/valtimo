/*
 * Copyright 2015-2021 Ritense BV, the Netherlands.
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
import {HttpClient} from '@angular/common/http';
import {Observable, of} from 'rxjs';
import {ConfigService} from '@valtimo/config';
import {Customer, CustomerCase, CustomerSearchRequest} from '../models';
import {delay} from 'rxjs/operators';

@Injectable({
  providedIn: 'root',
})
export class CustomerService {
  private valtimoEndpointUri: string;

  constructor(private http: HttpClient, configService: ConfigService) {
    this.valtimoEndpointUri = configService.config.valtimoApi.endpointUri;
  }

  getCustomers(request: CustomerSearchRequest): Observable<Array<Customer>> {
    return this.http.post<Array<Customer>>(
      `${this.valtimoEndpointUri}haalcentraal/personen`,
      request
    );
  }

  getCustomerCases(bsn: string): Observable<Array<CustomerCase>> {
    return of([
      {
        zaakNummer: 'ZAAK-2022-0000000893',
        zaakStatus: 'In behandeling',
        zaakType: 'ZaakPbacA',
        zaakId: 'ad0ad39c-fb87-4e34-b86d-038282d15839',
      },
      {
        zaakNummer: 'ZAAK-2022-0000000894',
        zaakStatus: 'In behandeling',
        zaakType: 'ZaakPbacAa',
        zaakId: 'ad0ad39c-fb87-4e34-b86d-038282d15833',
      },
      {
        zaakNummer: 'ZAAK-2022-0000000894',
        zaakStatus: 'In behandeling',
        zaakType: 'ZaakPbacA3',
        zaakId: 'ad0ad39c-fb87-4e34-b86d-038282d15836',
      },
    ]).pipe(delay(1500));
  }
}
