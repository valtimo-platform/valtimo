/*
 * Copyright 2015-2023 Ritense BV, the Netherlands.
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
  combineLatest,
  forkJoin,
  map,
  Observable,
  Subscription,
  switchMap,
  take,
} from 'rxjs';
import {CreateZaakConfig} from '../../models';
import {OpenZaakService} from '@valtimo/resource';
import {DocumentService} from '@valtimo/document';

@Component({
  selector: 'valtimo-create-zaak-configuration',
  templateUrl: './create-zaak-configuration.component.html',
  styleUrls: ['./create-zaak-configuration.component.scss'],
})
export class CreateZaakConfigurationComponent
  implements FunctionConfigurationComponent, OnInit, OnDestroy
{
  @Input() save$: Observable<void>;
  @Input() disabled$: Observable<boolean>;
  @Input() pluginId: string;
  @Input() prefillConfiguration$: Observable<CreateZaakConfig>;
  @Output() valid: EventEmitter<boolean> = new EventEmitter<boolean>();
  @Output() configuration: EventEmitter<CreateZaakConfig> = new EventEmitter<CreateZaakConfig>();

  public inputTypeTextZaakType: boolean;
  private saveSubscription!: Subscription;

  private readonly formValue$ = new BehaviorSubject<CreateZaakConfig | null>(null);
  private readonly valid$ = new BehaviorSubject<boolean>(false);

  readonly zaakTypeSelectItems$: Observable<Array<{id: string; text: string}>> = combineLatest([
    this.documentService.getAllDefinitions(),
  ]).pipe(
    map(([definitions]) =>
      forkJoin(
        definitions.content.map(definition =>
          this.openZaakService.getZaakTypeLink(definition.id.name)
        )
      ).pipe(
        map(zaakTypeLinks => zaakTypeLinks.filter(this.isNonNull)),
        map(zaakTypeLinks => this.distinct(zaakTypeLinks, zaakTypeLink => zaakTypeLink.zaakTypeUrl))
      )
    ),
    switchMap(zaakTypeLinksObs =>
      combineLatest([zaakTypeLinksObs, this.openZaakService.getZaakTypes()]).pipe(
        map(([zaakTypeLinks, zaakTypes]) =>
          zaakTypeLinks.map(zaakTypeLink => ({
            id: zaakTypeLink.zaakTypeUrl,
            text:
              zaakTypes.find(zaakType => zaakType.url === zaakTypeLink.zaakTypeUrl)?.omschrijving ||
              zaakTypeLink.zaakTypeUrl,
          }))
        )
      )
    )
  );

  constructor(
    private readonly openZaakService: OpenZaakService,
    private readonly documentService: DocumentService
  ) {}

  ngOnInit(): void {
    this.openSaveSubscription();
  }

  ngOnDestroy() {
    this.saveSubscription?.unsubscribe();
  }

  formValueChange(formValue: CreateZaakConfig): void {
    this.formValue$.next(formValue);
    this.handleValid(formValue);
  }

  toggleInputTypeZaakType() {
    this.inputTypeTextZaakType = !this.inputTypeTextZaakType;
  }

  private handleValid(formValue: CreateZaakConfig): void {
    const valid = !!(formValue.rsin && formValue.zaaktypeUrl);

    this.valid$.next(valid);
    this.valid.emit(valid);
  }

  private openSaveSubscription(): void {
    this.saveSubscription = this.save$?.subscribe(save => {
      combineLatest([this.formValue$, this.valid$])
        .pipe(take(1))
        .subscribe(([formValue, valid]) => {
          if (valid) {
            this.configuration.emit(formValue);
          }
        });
    });
  }

  private isNonNull<T>(value: T): value is NonNullable<T> {
    return value != null;
  }

  private distinct<T>(array: T[], callbackFn: (prop: any) => any): T[] {
    return array.filter(
      (value, index) =>
        index === array.findIndex(value2 => callbackFn(value) === callbackFn(value2))
    );
  }
}
