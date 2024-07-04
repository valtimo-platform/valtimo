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
import {CustomerService} from '../../services/customer.service';
import {BehaviorSubject, combineLatest, Observable, of} from 'rxjs';
import {catchError, debounceTime, map, switchMap, tap} from 'rxjs/operators';
import {TranslateService} from '@ngx-translate/core';
import {
  Customer,
  CustomerBsnSearchRequest,
  CustomerDataSearchRequest,
  CustomerSearchRequest,
  MappedCustomer,
} from '../../models';
import {ConfigService} from '@valtimo/config';
import {Router} from '@angular/router';

/**
 * @deprecated Will be replace by new plugins
 */
@Component({
  selector: 'valtimo-customer-list',
  templateUrl: './customer-list.component.html',
  styleUrls: ['./customer-list.component.scss'],
})
export class CustomerListComponent {
  fields$: Observable<Array<{key: string; label: string}>> = combineLatest([
    this.translateService.stream('customers.name'),
    this.translateService.stream('customers.citizenServiceNumber'),
    this.translateService.stream('customers.dateOfBirth'),
  ]).pipe(
    map(([nameLabel, numberLabel, dateOfBirthLabel]) => [
      {
        label: numberLabel,
        key: 'citizenServiceNumber',
      },
      {
        label: nameLabel,
        key: 'name',
      },
      {
        label: dateOfBirthLabel,
        key: 'dateOfBirth',
      },
    ])
  );

  readonly bsn$ = new BehaviorSubject<string>('');
  readonly bsnValid$: Observable<boolean> = this.bsn$.pipe(
    map(bsn => {
      const regex = new RegExp(/^[0-9]{9}$/gm);
      return regex.test(bsn);
    })
  );
  readonly dateOfBirth$ = new BehaviorSubject<string>('');
  readonly dateOfBirthValid$: Observable<boolean> = this.dateOfBirth$.pipe(
    map(dateOfBirth => {
      const regex = new RegExp(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/gm);
      return regex.test(dateOfBirth);
    })
  );
  readonly familyName$ = new BehaviorSubject<string>('');

  private readonly searchParameters$: Observable<CustomerSearchRequest | undefined> = combineLatest(
    [this.bsn$, this.dateOfBirth$, this.familyName$, this.bsnValid$, this.dateOfBirthValid$]
  ).pipe(
    map(([bsn, dateOfBirth, familyName, bsnValid, dateOfBirthValid]) => {
      if (bsn && bsnValid) {
        this.loading$.next(true);

        return {bsn};
      } else if (dateOfBirth && familyName && dateOfBirthValid) {
        this.loading$.next(true);

        return {
          geslachtsnaam: familyName,
          geboortedatum: dateOfBirth,
        };
      }

      return undefined;
    })
  );

  customers$: Observable<Array<MappedCustomer>> = this.searchParameters$.pipe(
    debounceTime(500),
    switchMap(searchParameters => {
      if (
        (searchParameters as CustomerBsnSearchRequest)?.bsn ||
        ((searchParameters as CustomerDataSearchRequest)?.geslachtsnaam &&
          (searchParameters as CustomerDataSearchRequest)?.geboortedatum)
      ) {
        return this.customerService
          .getCustomers(searchParameters as CustomerSearchRequest)
          .pipe(catchError(() => of([])));
      }

      return of([]);
    }),
    map(customers =>
      (customers as Array<Customer>).map(customer => ({
        citizenServiceNumber: customer.burgerservicenummer,
        dateOfBirth: customer.geboorteDatum,
        name: `${customer.geslachtsnaam}, ${customer.voornamen} ${customer.voorletters}`,
      }))
    ),
    tap(() => {
      this.loading$.next(false);
    })
  );

  readonly loading$ = new BehaviorSubject<boolean>(true);

  constructor(
    private readonly customerService: CustomerService,
    private readonly translateService: TranslateService,
    private readonly configService: ConfigService,
    private readonly router: Router
  ) {}

  bsnChange(bsn: string): void {
    this.clearDateOfBirth();
    this.clearFamilyName();
    this.bsn$.next(bsn);
  }

  dateOfBirthChange(dateOfBirth: string): void {
    this.clearBsn();
    this.dateOfBirth$.next(dateOfBirth);
  }

  familyNameChange(familyName: string): void {
    this.clearBsn();
    this.familyName$.next(familyName);
  }

  public rowClick(customer: MappedCustomer) {
    const config = this.configService.config;
    const bsn = customer?.citizenServiceNumber;

    if (bsn && config?.featureToggles?.enableHackathonCasesPage) {
      this.router.navigate([`/klanten/klant/${bsn}`]);
    }
  }

  private clearBsn(): void {
    this.bsn$.next('');
  }

  private clearDateOfBirth(): void {
    this.dateOfBirth$.next('');
  }

  private clearFamilyName(): void {
    this.familyName$.next('');
  }
}
