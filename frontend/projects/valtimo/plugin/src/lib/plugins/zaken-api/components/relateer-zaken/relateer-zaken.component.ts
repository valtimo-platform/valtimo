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

import {Component, EventEmitter, Input, OnDestroy, OnInit, Output} from '@angular/core';
import {FunctionConfigurationComponent} from '../../../../models';
import {
  BehaviorSubject,
  combineLatest,
  filter,
  map,
  Observable,
  Subscription,
  switchMap,
  take,
} from 'rxjs';
import {RelateerZakenConfig} from '../../models';
import {PluginTranslatePipe} from '../../../../pipes';
import {
  SelectItem
} from '@valtimo/components';

@Component({
  selector: 'valtimo-relateer-zaken',
  templateUrl: './relateer-zaken.component.html',
  providers: [PluginTranslatePipe],
})
export class RelateerZakenComponent
  implements FunctionConfigurationComponent, OnInit, OnDestroy
{
  @Input() save$: Observable<void>;
  @Input() disabled$: Observable<boolean>;
  @Input() set pluginId(value: string) {
    this.pluginId$.next(value);
  }
  @Input() prefillConfiguration$: Observable<RelateerZakenConfig>;
  @Output() valid: EventEmitter<boolean> = new EventEmitter<boolean>();
  @Output() configuration: EventEmitter<RelateerZakenConfig> =
    new EventEmitter<RelateerZakenConfig>();

  readonly pluginId$ = new BehaviorSubject<string>('');
  public readonly aardRelatieOptions$: Observable<Array<SelectItem>> = this.pluginId$.pipe(
    filter(pluginId => !!pluginId),
    switchMap(pluginId =>
      combineLatest([
        this.pluginTranslatePipe.transform('option-vervolg', pluginId),
        this.pluginTranslatePipe.transform('option-onderwerp', pluginId),
        this.pluginTranslatePipe.transform('option-bijdrage', pluginId),
      ])
    ),
    map(([vervolgText, onderwerpText, bijdrageText]) =>     [
      { id: 'vervolg', text: vervolgText },
      { id: 'onderwerp', text: onderwerpText },
      { id: 'bijdrage', text: bijdrageText }
    ])
  );

  private saveSubscription!: Subscription;

  private readonly formValue$ = new BehaviorSubject<RelateerZakenConfig | null>(null);
  private readonly valid$ = new BehaviorSubject<boolean>(false);

  constructor(
    private readonly pluginTranslatePipe: PluginTranslatePipe
  ) {
  }

  ngOnInit(): void {
    this.openSaveSubscription();
  }

  ngOnDestroy() {
    this.saveSubscription?.unsubscribe();
  }

  formValueChange(formValue: RelateerZakenConfig): void {
    this.formValue$.next(formValue);
    this.handleValid(formValue);
  }

  private handleValid(formValue: RelateerZakenConfig): void {
    const valid = !!formValue.teRelaterenZaakUri && !!formValue.aardRelatie;

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
}
