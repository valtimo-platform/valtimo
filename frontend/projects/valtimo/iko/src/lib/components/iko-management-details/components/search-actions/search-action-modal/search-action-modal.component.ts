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
import {CommonModule} from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
  signal,
} from '@angular/core';
import {FormBuilder, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';
import {TranslateModule} from '@ngx-translate/core';
import {CARBON_CONSTANTS, ValtimoCdsModalDirective} from '@valtimo/components';
import {ButtonModule, InputModule, LayerModule, ModalModule} from 'carbon-components-angular';
import {
  PropertyField,
  IkoDataRequestResponse,
  IkoRepositoryConfigResponse,
  IkoDataAggregateResponse,
} from '../../../../../models';
import {filter, map, Observable, switchMap, take} from 'rxjs';
import {IkoManagementApiService} from '../../../../../services';
import {toObservable} from '@angular/core/rxjs-interop';
import {PropertiesFormComponent} from '../../../../iko-management-properties/iko-management-properties.component';

@Component({
  selector: 'valtimo-iko-management-search-action-modal',
  templateUrl: './search-action-modal.component.html',
  styleUrl: './search-action-modal.component.scss',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    InputModule,
    TranslateModule,
    ModalModule,
    ValtimoCdsModalDirective,
    ButtonModule,
    LayerModule,
    PropertiesFormComponent,
  ],
})
export class IkoManagementSearchActionModalComponent {
  public readonly $modalType = signal<'add' | 'edit'>('add');
  public readonly $isOpen = signal<boolean>(false);
  @Input() public set open(value: boolean) {
    this.$isOpen.set(value);

    if (value) return;

    setTimeout(() => {
      this.$modalType.set('add');
      this.formGroup.reset();
      this.formGroup.get('key')?.enable();
    }, CARBON_CONSTANTS.modalAnimationMs);
  }
  public readonly $prefillData = signal<IkoDataAggregateResponse | null>(null);
  @Input() public set prefillData(value: IkoDataRequestResponse | null) {
    this.$prefillData.set(value);
    if (!value) return;

    this.$modalType.set('edit');
    this.formGroup.patchValue(value);
    this.formGroup.get('key')?.disable();
  }
  @Input() repositoryKey: string;
  @Input() aggregateKey: string;

  @Output() public readonly modalClose = new EventEmitter<IkoDataRequestResponse | null>();

  public readonly propertyFields$: Observable<PropertyField[]> = toObservable(this.$isOpen).pipe(
    filter((open: boolean) => !!open),
    map(() => this.repositoryKey),
    switchMap((repositoryKey: string | null) =>
      this.ikoManagementApiService.getIkoRepositoryConfig(repositoryKey ?? '')
    ),
    switchMap((repository: IkoRepositoryConfigResponse) =>
      this.ikoManagementApiService.getIkoDataRequestPropertyFields(repository.type)
    )
  );

  public readonly formGroup = this.fb.group({
    key: this.fb.control<string>('', Validators.required),
    title: this.fb.control<string>('', Validators.required),
    ikoDataAggregateKey: this.fb.control<string>(''),
    properties: this.fb.group({}),
  });

  constructor(
    private readonly fb: FormBuilder,
    private readonly ikoManagementApiService: IkoManagementApiService
  ) {}

  public get properties(): FormGroup | null {
    const properties = this.formGroup.get('properties');
    return !properties ? null : (properties as FormGroup);
  }

  public onCancel(): void {
    this.modalClose.emit(null);
  }

  public onSave(): void {
    this.propertyFields$.pipe(take(1)).subscribe(fields => {
      const formData = this.formGroup.getRawValue();
      fields.forEach(field => {
        if (formData.properties[field.key] && field.type === 'keyValueList') {
          formData.properties[field.key] = Array.isArray(formData.properties[field.key])
            ? formData.properties[field.key].reduce((acc: Record<string, any>, cur: any) => {
                if (cur.key) {
                  acc[cur.key] = cur.value;
                }
                return acc;
              }, {})
            : {};
        }
      });
      this.modalClose.emit(formData);
    });
  }
}
