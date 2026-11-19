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

import {Component, EventEmitter, Input, OnDestroy, OnInit, Output} from '@angular/core';
import {FunctionConfigurationComponent} from '../../../../models';
import {
  BehaviorSubject,
  catchError,
  combineLatest,
  filter,
  map,
  Observable,
  of,
  Subscription,
  take,
} from 'rxjs';
import {DeleteInformatieObjectConfig} from '../../models';
import {DocumentenApiService} from '../../services';
import {isValidDocumentReference} from '../../utils';
import {DOCUMENTEN_API_DELETE_INFORMATIE_OBJECT_ACTION_TEST_IDS} from '../../../../constants';

@Component({
  selector: 'valtimo-delete-informatie-object-configuration',
  templateUrl: './delete-informatie-object-configuration.component.html',
  standalone: false,
})
export class DeleteInformatieObjectConfigurationComponent
  implements FunctionConfigurationComponent, OnInit, OnDestroy
{
  @Input() save$: Observable<void>;
  @Input() disabled$: Observable<boolean>;
  @Input() pluginId: string;
  @Input() prefillConfiguration$: Observable<DeleteInformatieObjectConfig>;
  @Output() valid: EventEmitter<boolean> = new EventEmitter<boolean>();
  @Output() configuration: EventEmitter<DeleteInformatieObjectConfig> =
    new EventEmitter<DeleteInformatieObjectConfig>();

  protected readonly testIds = DOCUMENTEN_API_DELETE_INFORMATIE_OBJECT_ACTION_TEST_IDS;

  private readonly _subscriptions = new Subscription();
  private readonly formValue$ = new BehaviorSubject<DeleteInformatieObjectConfig | null>(null);
  private readonly _resolverPrefixes$ = new BehaviorSubject<string[] | null>(null);

  constructor(private readonly documentenApiService: DocumentenApiService) {}

  public ngOnInit(): void {
    this.loadResolverPrefixes();
    this.openValidSubscription();
    this.openSaveSubscription();
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  public formValueChange(formValue: DeleteInformatieObjectConfig): void {
    this.formValue$.next(formValue);
  }

  private loadResolverPrefixes(): void {
    // No prefixes on failure: literal URLs stay valid, expressions are rejected
    this.documentenApiService
      .getValueResolverPrefixes()
      .pipe(catchError(() => of([])))
      .subscribe(prefixes => this._resolverPrefixes$.next(prefixes));
  }

  private openValidSubscription(): void {
    this._subscriptions.add(
      combineLatest([this.formValue$, this._resolverPrefixes$])
        .pipe(
          filter(([formValue]) => !!formValue),
          map(([formValue, prefixes]) => this.isValid(formValue, prefixes))
        )
        .subscribe(valid => this.valid.emit(valid))
    );
  }

  private openSaveSubscription(): void {
    if (!this.save$) return;

    this._subscriptions.add(
      this.save$.subscribe(() => {
        combineLatest([this.formValue$, this._resolverPrefixes$])
          .pipe(take(1))
          .subscribe(([formValue, prefixes]) => {
            if (this.isValid(formValue, prefixes)) this.configuration.emit(formValue!);
          });
      })
    );
  }

  private isValid(
    formValue: DeleteInformatieObjectConfig | null,
    prefixes: string[] | null
  ): boolean {
    return !!formValue && !!prefixes && isValidDocumentReference(formValue.documentUrl, prefixes);
  }
}
