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
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
} from '@angular/core';
import {AbstractControl, FormBuilder, FormGroup, Validators} from '@angular/forms';
import {WarningFilled16} from '@carbon/icons';
import {TranslateService} from '@ngx-translate/core';
import {CARBON_CONSTANTS} from '@valtimo/components';
import {DocumentDefinitionCreateRequest, DocumentService} from '@valtimo/document';
import {FileItem, IconService, NotificationContent} from 'carbon-components-angular';
import {BehaviorSubject, combineLatest, map, Observable, Subscription, switchMap, take} from 'rxjs';
import {DossierManagementService} from '../../services/dossier-management.service';
import {STEPS, UPLOAD_STATUS, UPLOAD_STEP} from './dossier-management-upload.constants';

@Component({
  selector: 'valtimo-dossier-management-upload',
  templateUrl: './dossier-management-upload.component.html',
  styleUrls: ['./dossier-management-upload.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DossierManagementUploadComponent implements OnInit, OnDestroy {
  @Input() open = false;
  @Output() closeModal = new EventEmitter<boolean>();

  public acceptedFiles: string[] = ['.json', '.zip'];
  public selectedFile: File | null;

  private readonly _disabled$ = new BehaviorSubject<boolean>(true);

  public readonly UPLOAD_STEP = UPLOAD_STEP;
  public readonly UPLOAD_STATUS = UPLOAD_STATUS;
  public readonly activeStep$ = new BehaviorSubject<UPLOAD_STEP>(UPLOAD_STEP.PLUGINS);
  public readonly backButtonEnabled$: Observable<boolean> = this.activeStep$.pipe(
    map((activeStep: UPLOAD_STEP) =>
      [UPLOAD_STEP.FILE_SELECT, UPLOAD_STEP.ACCESS_CONTROL, UPLOAD_STEP.DASHBOARD].includes(
        activeStep
      )
    )
  );
  public readonly isStepAfterUpload$: Observable<boolean> = this.activeStep$.pipe(
    map(
      (activeStep: UPLOAD_STEP) =>
        ![UPLOAD_STEP.PLUGINS, UPLOAD_STEP.FILE_SELECT].includes(activeStep)
    )
  );
  public readonly showCloseButton$: Observable<boolean> = this.activeStep$.pipe(
    map((activeStep: UPLOAD_STEP) =>
      [UPLOAD_STEP.PLUGINS, UPLOAD_STEP.FILE_SELECT, UPLOAD_STEP.FILE_UPLOAD].includes(activeStep)
    )
  );
  public readonly nextButtonDisabled$: Observable<boolean> = combineLatest([
    this.activeStep$,
    this._disabled$,
  ]).pipe(map(([activeStep, disabled]) => activeStep !== UPLOAD_STEP.PLUGINS && disabled));
  public readonly notificationObj$: Observable<NotificationContent> = combineLatest([
    this.translateService.stream('interface.warning'),
    this.translateService.stream('dossierManagement.importDefinition.overwriteWarning'),
  ]).pipe(
    map(([title, message]) => ({
      type: 'warning',
      title,
      message,
      showClose: false,
      lowContrast: true,
    }))
  );
  public readonly showCheckboxError$ = new BehaviorSubject<boolean>(false);
  public readonly uploadStatus$ = new BehaviorSubject<UPLOAD_STATUS>(UPLOAD_STATUS.ACTIVE);

  public form: FormGroup = this.fb.group({
    file: this.fb.control(new Set<any>(), [Validators.required]),
  });

  private _checked = false;

  private readonly _importFile$ = new BehaviorSubject<string | FormData>('');
  private readonly _subscriptions = new Subscription();

  constructor(
    private readonly documentService: DocumentService,
    private readonly dossierManagementService: DossierManagementService,
    private readonly fb: FormBuilder,
    private readonly iconService: IconService,
    private readonly translateService: TranslateService
  ) {
    this.iconService.register(WarningFilled16);
  }

  public ngOnInit(): void {
    const control: AbstractControl | null = this.form.get('file');
    if (!control) {
      return;
    }

    this._subscriptions.add(
      this.form.get('file').valueChanges.subscribe((fileSet: Set<FileItem>) => {
        const [fileItem] = fileSet;
        if (!fileItem) {
          this._disabled$.next(true);
          this.showCheckboxError$.next(false);
          this._checked = false;
          return;
        }

        if (fileItem.file.type === 'application/json') {
          this.setJsonFile(fileItem);
          return;
        }

        this.setZipFile(fileItem);
      })
    );
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
    this.resetModal();
  }

  public onCloseModal(definitionUploaded?: boolean): void {
    this.closeModal.emit(definitionUploaded ?? false);
    this.resetModal();
  }

  public onBackClick(activeStep: UPLOAD_STEP): void {
    const prevIndex: number = STEPS.findIndex((step: UPLOAD_STEP) => step === activeStep) - 1;
    if (prevIndex === -1) {
      return;
    }

    this.activeStep$.next(STEPS[prevIndex]);
  }

  public onNextClick(activeStep: UPLOAD_STEP): void {
    const nextIndex: number = STEPS.findIndex((step: UPLOAD_STEP) => step === activeStep) + 1;
    if (nextIndex === STEPS.length) {
      return;
    }

    if (activeStep === UPLOAD_STEP.FILE_SELECT && !this._checked) {
      this.showCheckboxError$.next(true);
      return;
    }

    this.activeStep$.next(STEPS[nextIndex]);
    if (STEPS[nextIndex] !== UPLOAD_STEP.FILE_UPLOAD) {
      return;
    }

    this.uploadDefinition();
  }

  public onCheckedChange(checked: boolean): void {
    this._checked = checked;

    if (!checked) {
      return;
    }

    this.showCheckboxError$.next(false);
  }

  private setJsonFile(fileItem: FileItem | undefined): void {
    const file = fileItem?.file;

    if (!file) {
      this.clearJsonString();
      return;
    }
    const reader = new FileReader();

    reader.onloadend = () => {
      const result = (reader.result ?? '').toString();
      if (this.stringIsValidJson(result)) {
        this._disabled$.next(false);
        this._importFile$.next(result);
        return;
      }

      this.clearJsonString();
      this.setErrorState(fileItem);
    };

    reader.readAsText(file);
  }

  private setZipFile(fileItem: FileItem): void {
    const file = fileItem?.file;

    if (!file) {
      this._importFile$.next('');
      return;
    }

    const blob = new Blob([fileItem.file], {type: fileItem.file.type});
    const fd = new FormData();
    fd.append('file', blob, fileItem.file.name);
    this._importFile$.next(fd);
    this._disabled$.next(false);
  }

  private uploadDefinition(): void {
    this._disabled$.next(true);
    this._importFile$
      .pipe(
        switchMap((file: string | FormData) =>
          file instanceof FormData
            ? this.dossierManagementService.importDocumentDefinitionZip(file)
            : this.documentService.createDocumentDefinitionForManagement(
                new DocumentDefinitionCreateRequest(file)
              )
        ),
        take(1)
      )
      .subscribe({
        next: () => {
          this._disabled$.next(false);
          this.uploadStatus$.next(UPLOAD_STATUS.FINISHED);
        },
        error: () => {
          this.uploadStatus$.next(UPLOAD_STATUS.ERROR);
          this._disabled$.next(false);
        },
      });
  }

  private clearJsonString(): void {
    this._importFile$.next('');
  }

  private stringIsValidJson(string: string) {
    try {
      JSON.parse(string);
    } catch (e) {
      return false;
    }
    return true;
  }

  private setErrorState(fileItem: FileItem): void {
    this._disabled$.next(true);
    fileItem.invalid = true;
    fileItem.invalidTitle = this.translateService.instant(
      'dossierManagement.importDefinition.invalidJsonError.title'
    );
    fileItem.invalidText = this.translateService.instant(
      'dossierManagement.importDefinition.invalidJsonError.text'
    );
  }

  private resetModal(): void {
    setTimeout(() => {
      this.activeStep$.next(UPLOAD_STEP.PLUGINS);
      this.uploadStatus$.next(UPLOAD_STATUS.ACTIVE);
      this.showCheckboxError$.next(false);
    }, CARBON_CONSTANTS.modalAnimationMs);
  }
}
