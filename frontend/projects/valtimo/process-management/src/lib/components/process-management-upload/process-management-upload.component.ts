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
import {ChangeDetectionStrategy, Component} from '@angular/core';
import {FormBuilder, ReactiveFormsModule, Validators} from '@angular/forms';
import {TranslateModule, TranslateService} from '@ngx-translate/core';
import {CARBON_CONSTANTS} from '@valtimo/components';
import {
  ButtonModule,
  FileUploaderModule,
  LayerModule,
  ModalModule,
  NotificationService,
} from 'carbon-components-angular';
import {map, startWith} from 'rxjs';
import {ProcessManagementService, ProcessManagementStateService} from '../../services';

@Component({
  selector: 'valtimo-process-management-upload',
  templateUrl: './process-management-upload.component.html',
  styleUrls: ['./process-management-upload.component.scss'],
  providers: [NotificationService],
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
export class ProcessManagementUploadComponent {
  public readonly modalOpen$ = this.processManagementStateService.openModal$;

  public readonly ACCEPTED_FILES: string[] = ['bpmn'];

  public readonly form = this.formBuilder.group({
    file: this.formBuilder.control(new Set<any>(), [Validators.required]),
  });

  public readonly fileSelected$ = this.form.get('file')?.valueChanges.pipe(
    startWith(null),
    map(value => !!(value instanceof Set && value.size > 0))
  );

  constructor(
    private readonly processManagementStateService: ProcessManagementStateService,
    private readonly processManagementService: ProcessManagementService,
    private readonly formBuilder: FormBuilder,
    private readonly notificationService: NotificationService,
    private readonly translateService: TranslateService
  ) {}

  public closeModal(): void {
    this.processManagementStateService.closeModal();

    setTimeout(() => {
      this.form.reset();
    }, CARBON_CONSTANTS.modalAnimationMs);
  }

  public uploadProcessBpmn(): void {
    const bpmnFile = this.form.value?.file?.values()?.next()?.value?.file;

    if (!bpmnFile) return;

    this.processManagementService.deployBpmn(bpmnFile).subscribe({
      next: () => {
        this.notificationService.showNotification({
          type: 'success',
          title: this.translateService.instant('processManagement.upload.success'),
          duration: CARBON_CONSTANTS.notificationDuration,
        });
        this.closeModal();
        this.processManagementStateService.reloadDefinitions();
      },
      error: () => {
        this.notificationService.showNotification({
          type: 'error',
          title: this.translateService.instant('processManagement.upload.failure'),
          duration: CARBON_CONSTANTS.notificationDuration,
        });
      },
    });
  }
}
