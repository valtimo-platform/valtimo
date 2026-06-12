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
import {HttpErrorResponse} from '@angular/common/http';
import {ChangeDetectionStrategy, Component} from '@angular/core';
import {FormBuilder, ReactiveFormsModule, Validators} from '@angular/forms';
import {TranslateModule, TranslateService} from '@ngx-translate/core';
import {
  CARBON_CONSTANTS,
  ConfirmationModalModule,
  RenderInBodyComponent,
} from '@valtimo/components';
import {GlobalNotificationService} from '@valtimo/shared';
import {ProcessDefinitionConflictResponse, ProcessLinkService} from '@valtimo/process-link';
import {
  ButtonModule,
  FileUploaderModule,
  LayerModule,
  ModalModule,
} from 'carbon-components-angular';
import {BehaviorSubject, from, map, startWith, switchMap} from 'rxjs';
import {ProcessManagementService, ProcessManagementStateService} from '../../services';

@Component({
  selector: 'valtimo-process-management-upload',
  templateUrl: './process-management-upload.component.html',
  styleUrls: ['./process-management-upload.component.scss'],
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
    ConfirmationModalModule,
    RenderInBodyComponent,
  ],
})
export class ProcessManagementUploadComponent {
  public readonly modalOpen$ = this.processManagementStateService.openModal$;
  public readonly showReplaceConfirmationModal$ = new BehaviorSubject<boolean>(false);
  public replaceModalContent = '';

  private _conflictingProcessDefinitionId: string | null = null;

  public readonly ACCEPTED_FILES: string[] = ['bpmn'];

  public readonly form = this.formBuilder.group({
    file: this.formBuilder.control(new Set<any>(), [Validators.required]),
  });

  public readonly fileSelected$ = this.form.get('file')?.valueChanges.pipe(
    startWith(null),
    map(value => !!(value instanceof Set && value.size > 0))
  );

  constructor(
    private readonly formBuilder: FormBuilder,
    private readonly notificationService: GlobalNotificationService,
    private readonly processManagementService: ProcessManagementService,
    private readonly processManagementStateService: ProcessManagementStateService,
    private readonly processLinkService: ProcessLinkService,
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

    if (this.processManagementService.$context() === 'case') {
      this.uploadForCase(bpmnFile);
    } else {
      this.uploadIndependent(bpmnFile);
    }
  }

  public confirmReplace(): void {
    const processDefinitionId = this._conflictingProcessDefinitionId;
    this.replaceModalContent = '';
    this._conflictingProcessDefinitionId = null;

    if (!processDefinitionId) {
      this.notificationService.showNotification({
        type: 'error',
        title: this.translateService.instant('processManagement.upload.failure'),
      });
      return;
    }

    const bpmnFile = this.form.value?.file?.values()?.next()?.value?.file;
    if (!bpmnFile) return;

    const isCase = this.processManagementService.$context() === 'case';

    from(bpmnFile.text())
      .pipe(
        switchMap(bpmnXml =>
          isCase
            ? this.processLinkService.updateProcessDefinitionForCase(
                [],
                processDefinitionId,
                `${bpmnXml}`,
                this.processManagementService.caseDefinitionKey,
                this.processManagementService.caseDefinitionVersionTag
              )
            : this.processLinkService.updateProcessDefinition([], processDefinitionId, `${bpmnXml}`)
        )
      )
      .subscribe({
        next: () => {
          this.notificationService.showNotification({
            type: 'success',
            title: this.translateService.instant('processManagement.upload.success'),
          });
          this.closeModal();
          this.processManagementStateService.reloadDefinitions();
        },
        error: () => {
          this.notificationService.showNotification({
            type: 'error',
            title: this.translateService.instant('processManagement.upload.failure'),
          });
        },
      });
  }

  public clearReplaceModal(): void {
    this.replaceModalContent = '';
  }

  private uploadForCase(bpmnFile: File): void {
    from(bpmnFile.text())
      .pipe(
        switchMap(bpmnXml =>
          this.processLinkService.createProcessDefinitionForCase(
            [],
            `${bpmnXml}`,
            this.processManagementService.caseDefinitionKey,
            this.processManagementService.caseDefinitionVersionTag
          )
        )
      )
      .subscribe({
        next: () => {
          this.notificationService.showNotification({
            type: 'success',
            title: this.translateService.instant('processManagement.upload.success'),
          });
          this.closeModal();
          this.processManagementStateService.reloadDefinitions();
        },
        error: (error: unknown) => {
          const isConflict = error instanceof HttpErrorResponse && error.status === 409;
          if (isConflict) {
            const body = (error as HttpErrorResponse)
              .error as ProcessDefinitionConflictResponse;
            this._conflictingProcessDefinitionId = body?.processDefinitionId ?? null;
            this.replaceModalContent = this.buildReplaceModalContent(body);
            this.showReplaceConfirmationModal$.next(true);
            return;
          }

          this.notificationService.showNotification({
            type: 'error',
            title: this.translateService.instant('processManagement.upload.failure'),
          });
        },
      });
  }

  private uploadIndependent(bpmnFile: File): void {
    from(bpmnFile.text())
      .pipe(switchMap(bpmnXml => this.processLinkService.createProcessDefinition([], `${bpmnXml}`)))
      .subscribe({
        next: () => {
          this.notificationService.showNotification({
            type: 'success',
            title: this.translateService.instant('processManagement.upload.success'),
          });
          this.closeModal();
          this.processManagementStateService.reloadDefinitions();
        },
        error: (error: unknown) => {
          const isConflict = error instanceof HttpErrorResponse && error.status === 409;
          if (isConflict) {
            const body = (error as HttpErrorResponse)
              .error as ProcessDefinitionConflictResponse;
            this._conflictingProcessDefinitionId = body?.processDefinitionId ?? null;
            this.replaceModalContent = this.buildReplaceModalContent(body);
            this.showReplaceConfirmationModal$.next(true);
            return;
          }

          this.notificationService.showNotification({
            type: 'error',
            title: this.translateService.instant('processManagement.upload.failure'),
          });
        },
      });
  }

  private buildReplaceModalContent(body: ProcessDefinitionConflictResponse): string {
    if (body?.processDefinitionKey) {
      const label = body.processDefinitionName
        ? `${body.processDefinitionKey} (${body.processDefinitionName})`
        : body.processDefinitionKey;
      return this.translateService.instant(
        'processManagement.upload.replaceContentWithDuplicates',
        {duplicates: label}
      );
    }

    return this.translateService.instant('processManagement.upload.replaceContent');
  }
}
