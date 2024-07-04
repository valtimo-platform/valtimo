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
import {BehaviorSubject, combineLatest, map, Observable, Subscription, take} from 'rxjs';
import {TranslateService} from '@ngx-translate/core';
import {PluginTranslationService} from '../../../../services';
import {CreatePortalTaskConfig, FormType, OtherReceiver, Receiver} from '../../models';
import {SelectItem} from '@valtimo/components';

@Component({
  selector: 'valtimo-create-portal-task',
  templateUrl: './create-portal-task.component.html',
  styleUrls: ['./create-portal-task.component.scss'],
})
export class CreatePortalTaskComponent
  implements FunctionConfigurationComponent, OnInit, OnDestroy
{
  @Input() save$: Observable<void>;
  @Input() disabled$: Observable<boolean>;
  @Input() pluginId: string;
  @Input() prefillConfiguration$: Observable<CreatePortalTaskConfig>;
  @Output() valid: EventEmitter<boolean> = new EventEmitter<boolean>();
  @Output() configuration: EventEmitter<CreatePortalTaskConfig> =
    new EventEmitter<CreatePortalTaskConfig>();
  readonly FORM_TYPE_ITEMS: Array<FormType> = ['id', 'url'];
  readonly formTypeSelectItems$ = this.selectItemsToTranslatedItems(this.FORM_TYPE_ITEMS);

  readonly RECEIVER_ITEMS: Array<Receiver> = ['zaakInitiator', 'other'];
  readonly receiverSelectItems$ = this.selectItemsToTranslatedItems(this.RECEIVER_ITEMS);

  readonly OTHER_RECEIVER_ITEMS: Array<OtherReceiver> = ['kvk', 'bsn'];
  readonly otherReceiverSelectItems$ = this.selectItemsToTranslatedItems(this.OTHER_RECEIVER_ITEMS);

  private saveSubscription!: Subscription;
  private readonly formValue$ = new BehaviorSubject<CreatePortalTaskConfig | null>(null);
  readonly formTypeIsUrl$: Observable<boolean> = this.formValue$.pipe(
    map(value => !!(value?.formType === 'url'))
  );
  readonly receiverIsOther$: Observable<boolean> = this.formValue$.pipe(
    map(value => !!(value?.receiver === 'other'))
  );
  private readonly valid$ = new BehaviorSubject<boolean>(false);

  constructor(
    private readonly translateService: TranslateService,
    private readonly pluginTranslationService: PluginTranslationService
  ) {}

  ngOnInit(): void {
    this.openSaveSubscription();
  }

  ngOnDestroy(): void {
    this.saveSubscription?.unsubscribe();
  }

  formValueChange(formValue: CreatePortalTaskConfig): void {
    this.formValue$.next(formValue);
    this.handleValid(formValue);
  }

  private handleValid(formValue: CreatePortalTaskConfig): void {
    const valid =
      !!formValue.formType &&
      (!!(formValue.formType === 'url' && formValue.formTypeUrl) ||
        !!(formValue.formType === 'id' && formValue.formTypeId)) &&
      !!formValue?.receiver &&
      (formValue.receiver === 'other'
        ? !!(formValue.identificationValue && formValue.identificationKey)
        : true);

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

  private selectItemsToTranslatedItems(selectItems: Array<string>): Observable<Array<SelectItem>> {
    return this.translateService.stream('key').pipe(
      map(() =>
        selectItems.map(item => ({
          id: item,
          text: this.pluginTranslationService.instant(item, this.pluginId),
        }))
      )
    );
  }
}
