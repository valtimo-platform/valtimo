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

import {Component, EventEmitter, Input, OnDestroy, OnInit, Output} from '@angular/core';
import {FunctionConfigurationComponent} from '../../../../models';
import {BehaviorSubject, combineLatest, Observable, Subscription, take} from 'rxjs';
import {PatchZaakBesluitConfig} from '../../models';
import {CaseManagementParams, ManagementContext} from '@valtimo/shared';

@Component({
  standalone: false,
  selector: 'valtimo-patch-zaak-besluit-configuration',
  templateUrl: './patch-zaak-besluit-configuration.component.html',
  styleUrls: ['./patch-zaak-besluit-configuration.component.scss'],
})
export class PatchZaakBesluitConfigurationComponent
  implements FunctionConfigurationComponent, OnInit, OnDestroy
{
  @Input() save$: Observable<void>;
  @Input() disabled$: Observable<boolean>;
  @Input() set pluginId(value: string) {
    this.pluginId$.next(value);
  }
  @Input() prefillConfiguration$: Observable<PatchZaakBesluitConfig>;
  @Input() context$: Observable<[ManagementContext, CaseManagementParams]>;

  @Output() valid: EventEmitter<boolean> = new EventEmitter<boolean>();
  @Output() configuration: EventEmitter<PatchZaakBesluitConfig> =
    new EventEmitter<PatchZaakBesluitConfig>();

  readonly pluginId$ = new BehaviorSubject<string>('');

  private readonly formValue$ = new BehaviorSubject<PatchZaakBesluitConfig | null>(null);
  private readonly valid$ = new BehaviorSubject<boolean>(false);
  private readonly _subscriptions = new Subscription();

  public ngOnInit(): void {
    this.initSaveHandling();
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  public formValueChange(formValue: PatchZaakBesluitConfig): void {
    this.formValue$.next(formValue);
    this.handleValid(formValue);
  }

  private handleValid(formValue: PatchZaakBesluitConfig): void {
    const valid = !!formValue.besluitUrl
    this.valid$.next(valid);
    this.valid.emit(valid);
  }

  private initSaveHandling(): void {
    if (!this.save$) return;

    const sub = this.save$.subscribe(() => {
      combineLatest([this.formValue$, this.valid$])
        .pipe(take(1))
        .subscribe(([formValue, valid]) => {
          if (valid) {
            this.configuration.emit(formValue);
          }
        });
    });

    this._subscriptions.add(sub);
  }
}
