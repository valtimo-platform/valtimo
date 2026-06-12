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
import {
  ButtonModule,
  FileUploaderModule,
  LayerModule,
  ModalModule,
} from 'carbon-components-angular';
import {BehaviorSubject, from, map, startWith, switchMap} from 'rxjs';
import {BuildingBlockManagementDetailService} from '../../services';
import {BuildingBlockProcessDefinitionConflictResponse, ProcessLinkService} from '@valtimo/process-link';

@Component({
  selector: 'valtimo-building-block-management-process-upload',
  templateUrl: './building-block-management-process-upload.component.html',
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
export class BuildingBlockManagementProcessUploadComponent {
  public readonly modalOpen$ =
    this.buildingBlockManagementDetailService.showProcessDefinitionUploadModal$;
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
    private readonly processLinkService: ProcessLinkService,
    private readonly buildingBlockManagementDetailService: BuildingBlockManagementDetailService,
    private readonly translateService: TranslateService
  ) {}

  public closeModal(): void {
    this.buildingBlockManagementDetailService.hideProcessDefinitionUploadModal();

    setTimeout(() => {
      this.form.reset();
    }, CARBON_CONSTANTS.modalAnimationMs);
  }

  public uploadProcessBpmn(): void {
    const bpmnFile = this.form.value?.file?.values()?.next()?.value?.file;

    if (!bpmnFile) return;

    from(bpmnFile.text())
      .pipe(
        switchMap(bpmnXml =>
          this.processLinkService.createProcessDefinitionForBuildingBlock(
            [],
            `${bpmnXml}`,
            this.buildingBlockManagementDetailService.buildingBlockDefinitionKey,
            this.buildingBlockManagementDetailService.buildingBlockDefinitionVersionTag
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
          this.buildingBlockManagementDetailService.reloadProcessDefinitions();
        },
        error: (error: unknown) => {
          const isConflict = error instanceof HttpErrorResponse && error.status === 409;
          if (isConflict) {
            const body = (error as HttpErrorResponse).error as BuildingBlockProcessDefinitionConflictResponse;
            this._conflictingProcessDefinitionId =
              body?.duplicateProcessDefinitions?.[0]?.processDefinitionId ?? null;
            this.replaceModalContent = this.buildReplaceModalContent(error as HttpErrorResponse);
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

    from(bpmnFile.text())
      .pipe(
        switchMap(bpmnXml =>
          this.processLinkService.updateProcessDefinitionForBuildingBlock(
            [],
            processDefinitionId,
            `${bpmnXml}`,
            this.buildingBlockManagementDetailService.buildingBlockDefinitionKey,
            this.buildingBlockManagementDetailService.buildingBlockDefinitionVersionTag,
            true
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
          this.buildingBlockManagementDetailService.reloadProcessDefinitions();
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

  private getDuplicateKeyMessage(error: HttpErrorResponse): string | null {
    const response = error.error;
    const duplicates =
      response?.duplicateProcessDefinitions || response?.parameters?.duplicateProcessDefinitions;
    if (Array.isArray(duplicates) && duplicates.length > 0) {
      const duplicateList = duplicates
        .map(item => {
          if (!item?.key) return null;
          return item.name ? `${item.key} (${item.name})` : item.key;
        })
        .filter(Boolean)
        .join(', ');
      if (duplicateList) {
        return this.translateService.instant(
          'processManagement.upload.replaceContentWithDuplicates',
          {
            duplicates: duplicateList,
          }
        );
      }
    }

    return null;
  }

  private buildReplaceModalContent(error: HttpErrorResponse): string {
    return (
      this.getDuplicateKeyMessage(error) ||
      this.translateService.instant('processManagement.upload.replaceContent')
    );
  }
}
