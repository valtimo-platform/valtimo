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
  OnDestroy,
  OnInit,
  Output,
} from '@angular/core';
import {FormBuilder, ReactiveFormsModule, Validators} from '@angular/forms';
import {TranslateModule, TranslateService} from '@ngx-translate/core';
import {CARBON_CONSTANTS} from '@valtimo/components';
import {
  ButtonModule,
  FileUploaderModule,
  LayerModule,
  ModalModule,
} from 'carbon-components-angular';
import {BehaviorSubject, map, Observable, startWith, Subscription} from 'rxjs';
import {GlobalNotificationService} from '@valtimo/layout';

@Component({
  selector: 'valtimo-form-management-upload',
  templateUrl: './form-management-upload.component.html',
  styleUrls: ['./form-management-upload.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    FileUploaderModule,
    ModalModule,
    LayerModule,
    ReactiveFormsModule,
    ButtonModule,
  ],
})
export class FormManagementUploadComponent implements OnInit, OnDestroy {
  @Input() public readonly show$: Observable<boolean>;

  @Output() public readonly definitionUploaded: EventEmitter<any> = new EventEmitter();

  public readonly modalOpen$ = new BehaviorSubject<boolean>(false);

  public readonly ACCEPTED_FILES: string[] = ['json'];

  public readonly form = this.formBuilder.group({
    file: this.formBuilder.control(new Set<any>(), [Validators.required]),
  });

  public readonly fileSelected$ = this.form.get('file')?.valueChanges.pipe(
    startWith(null),
    map(value => !!(value instanceof Set && value.size > 0))
  );

  private readonly _subscriptions = new Subscription();

  constructor(
    private readonly formBuilder: FormBuilder,
    private readonly notificationService: GlobalNotificationService,
    private readonly translateService: TranslateService
  ) {}

  public ngOnInit(): void {
    this._subscriptions.add(
      this.show$.subscribe(show => {
        this.modalOpen$.next(show);
      })
    );
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  public closeModal(): void {
    this.modalOpen$.next(false);

    setTimeout(() => {
      this.form.reset();
    }, CARBON_CONSTANTS.modalAnimationMs);
  }

  public async uploadFormDefinition(): Promise<void> {
    const formioDefinition: File = this.form.value?.file?.values()?.next()?.value?.file;
    const formioDefinitionString = await formioDefinition.text();

    if (!formioDefinitionString) return;

    this.notificationService.showNotification({
      type: 'success',
      title: this.translateService.instant('formManagement.upload.success'),
      duration: CARBON_CONSTANTS.notificationDuration,
    });

    this.definitionUploaded.emit(formioDefinitionString);

    this.modalOpen$.next(false);
  }
}
