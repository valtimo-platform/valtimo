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
import {ChangeDetectionStrategy, ChangeDetectorRef, Component, ViewChild} from '@angular/core';
import {FormBuilder, ReactiveFormsModule, Validators} from '@angular/forms';
import {TranslateModule, TranslateService} from '@ngx-translate/core';
import {
  CARBON_CONSTANTS,
  ConfirmationModalModule,
  RenderInBodyComponent,
  ValtimoCdsModalDirective,
} from '@valtimo/components';
import {GlobalNotificationService} from '@valtimo/shared';
import {PluginConfigurationMappingComponent} from '@valtimo/plugin';
import {ProcessDefinitionConflictResponse, ProcessLinkService} from '@valtimo/process-link';
import {
  ButtonModule,
  FileItem,
  FileUploaderModule,
  LayerModule,
  ModalModule,
  NotificationModule,
} from 'carbon-components-angular';
import {BehaviorSubject, from, map, startWith, switchMap, take} from 'rxjs';
import {MissingReference, MissingReferenceType, ProcessDefinitionImportPreview} from '../../models';
import {ProcessManagementService, ProcessManagementStateService} from '../../services';

enum UPLOAD_STEP {
  FILE_SELECT = 'fileSelect',
  REVIEW = 'review',
  SUMMARY = 'summary',
}

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
    ValtimoCdsModalDirective,
    NotificationModule,
    PluginConfigurationMappingComponent,
  ],
})
export class ProcessManagementUploadComponent {
  public readonly modalOpen$ = this.processManagementStateService.openModal$;
  public readonly showReplaceConfirmationModal$ = new BehaviorSubject<boolean>(false);
  public replaceModalContent = '';

  private _conflictingProcessDefinitionId: string | null = null;

  // Extensions need a leading dot: the file dialog only filters on valid accept tokens, and Carbon
  // matches a dropped file on its dot-prefixed extension
  public readonly ACCEPTED_FILES: string[] = ['.bpmn', '.zip'];

  public readonly UPLOAD_STEP = UPLOAD_STEP;

  public readonly form = this.formBuilder.group({
    file: this.formBuilder.control(new Set<any>(), [Validators.required]),
  });

  // The current control value is read instead of the emitted one, so this also reports the selection
  // correctly when the footer is re-created after going back to the file select step
  public readonly fileSelected$ = this.form.get('file')?.valueChanges.pipe(
    startWith(null),
    map(() => {
      const value = this.form.get('file')?.value;
      return !!(value instanceof Set && value.size > 0);
    })
  );

  public readonly activeStep$ = new BehaviorSubject<UPLOAD_STEP>(UPLOAD_STEP.FILE_SELECT);
  public readonly preview$ = new BehaviorSubject<ProcessDefinitionImportPreview | null>(null);
  public readonly missingReferences$ = new BehaviorSubject<MissingReference[]>([]);
  public readonly importing$ = new BehaviorSubject<boolean>(false);

  @ViewChild(PluginConfigurationMappingComponent)
  private _pluginConfigurationMapping?: PluginConfigurationMappingComponent;

  /**
   * Leaving the file select step destroys cds-file-uploader, which empties the form control: every
   * cds-file emits (remove) from its own ngOnDestroy. So the selection is kept here to import it
   * afterwards, and to restore it when the user goes back.
   */
  private _selectedFile: File | null = null;
  private _selectedFileItems: Set<FileItem> | null = null;

  constructor(
    private readonly formBuilder: FormBuilder,
    private readonly notificationService: GlobalNotificationService,
    private readonly processManagementService: ProcessManagementService,
    private readonly processManagementStateService: ProcessManagementStateService,
    private readonly processLinkService: ProcessLinkService,
    private readonly translateService: TranslateService,
    private readonly changeDetectorRef: ChangeDetectorRef
  ) {}

  public closeModal(): void {
    this.processManagementStateService.closeModal();

    setTimeout(() => {
      this.form.reset();
      this.activeStep$.next(UPLOAD_STEP.FILE_SELECT);
      this.preview$.next(null);
      this.missingReferences$.next([]);
      this.importing$.next(false);
      this._selectedFile = null;
      this._selectedFileItems = null;
    }, CARBON_CONSTANTS.modalAnimationMs);
  }

  public uploadProcessBpmn(): void {
    const file = this.form.value?.file?.values()?.next()?.value?.file;

    if (!file) return;

    // A package of an earlier selection must not be imported when another file is uploaded
    this._selectedFile = null;
    this._selectedFileItems = null;

    if (this.isZip(file)) {
      this.previewProcessPackage(file);
      return;
    }

    if (this.processManagementService.$context() === 'case') {
      this.uploadForCase(file);
    } else {
      this.uploadIndependent(file);
    }
  }

  public importProcessPackage(): void {
    const existingProcessDefinitionKeys = this.preview$.value?.existingProcessDefinitionKeys ?? [];

    // Ask before replacing, the same way uploading a single bpmn file does
    if (existingProcessDefinitionKeys.length > 0) {
      this.showReplaceConfirmation(
        this.translateService.instant('processManagement.upload.replaceContentWithDuplicates', {
          duplicates: existingProcessDefinitionKeys.join(', '),
        })
      );
      return;
    }

    this.executeImportProcessPackage();
  }

  private showReplaceConfirmation(content: string): void {
    this.replaceModalContent = content;
    // The content is bound from a plain field, so this OnPush component has to be checked again.
    // The bpmn flow sets it from an http error callback, which does not mark this view dirty itself.
    this.changeDetectorRef.markForCheck();
    this.showReplaceConfirmationModal$.next(true);
  }

  private executeImportProcessPackage(): void {
    const file = this._selectedFile;
    if (!file) return;

    this.importing$.next(true);
    this.processManagementService
      .importProcessDefinition(
        this.toFormData(file),
        this._pluginConfigurationMapping?.getMappings()
      )
      .pipe(take(1))
      .subscribe({
        next: result => {
          this.importing$.next(false);
          this.processManagementStateService.reloadDefinitions();

          if (result.missingReferences.length > 0) {
            // Keep the summary on screen: a toast disappears before it can be read
            this.missingReferences$.next(result.missingReferences);
            this.activeStep$.next(UPLOAD_STEP.SUMMARY);
            return;
          }

          this.notificationService.showNotification({
            type: 'success',
            title: this.translateService.instant('processManagement.upload.success'),
          });
          this.closeModal();
        },
        error: () => {
          this.importing$.next(false);
          this.notificationService.showNotification({
            type: 'error',
            title: this.translateService.instant('processManagement.upload.failure'),
          });
        },
      });
  }

  public onBackClick(): void {
    this.activeStep$.next(UPLOAD_STEP.FILE_SELECT);
    // Restore the selection the file uploader dropped when it was destroyed
    if (this._selectedFileItems) {
      this.form.get('file')?.setValue(this._selectedFileItems);
    }
  }

  public getMissingReferenceGroups(
    missingReferences: MissingReference[]
  ): {type: MissingReferenceType; references: string[]}[] {
    return missingReferences.reduce(
      (groups, missingReference) => {
        const group = groups.find(({type}) => type === missingReference.type);
        if (group) {
          group.references = [...new Set([...group.references, missingReference.reference])];
          return groups;
        }
        return [...groups, {type: missingReference.type, references: [missingReference.reference]}];
      },
      [] as {type: MissingReferenceType; references: string[]}[]
    );
  }

  private previewProcessPackage(file: File): void {
    const fileItem: FileItem | undefined = this.form.value?.file?.values()?.next()?.value;

    this.processManagementService
      .previewProcessDefinitionImport(this.toFormData(file))
      .pipe(take(1))
      .subscribe({
        next: preview => {
          this._selectedFile = file;
          this._selectedFileItems = this.form.value?.file ?? null;
          this.preview$.next(preview);
          this.missingReferences$.next(preview.missingReferences);

          // Nothing to review, so the package can be imported straight away
          if (preview.pluginConfigurations.length === 0 && preview.missingReferences.length === 0) {
            this.importProcessPackage();
            return;
          }

          this.activeStep$.next(UPLOAD_STEP.REVIEW);
        },
        error: () => {
          if (fileItem) {
            fileItem.invalid = true;
            fileItem.invalidTitle = this.translateService.instant(
              'processManagement.upload.invalidZip.title'
            );
            fileItem.invalidText = this.translateService.instant(
              'processManagement.upload.invalidZip.text'
            );
          }
        },
      });
  }

  private isZip(file: File): boolean {
    return file.name.toLowerCase().endsWith('.zip');
  }

  private toFormData(file: File): FormData {
    const formData = new FormData();
    formData.append('file', file, file.name);
    return formData;
  }

  public confirmReplace(): void {
    const processDefinitionId = this._conflictingProcessDefinitionId;
    this.replaceModalContent = '';
    this._conflictingProcessDefinitionId = null;

    // A selected package is only set while importing a zip, which replaces through the import itself
    if (this._selectedFile) {
      this.executeImportProcessPackage();
      return;
    }

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
            const body = (error as HttpErrorResponse).error as ProcessDefinitionConflictResponse;
            this._conflictingProcessDefinitionId = body?.processDefinitionId ?? null;
            this.showReplaceConfirmation(this.buildReplaceModalContent(body));
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
            const body = (error as HttpErrorResponse).error as ProcessDefinitionConflictResponse;
            this._conflictingProcessDefinitionId = body?.processDefinitionId ?? null;
            this.showReplaceConfirmation(this.buildReplaceModalContent(body));
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
