/*
 * Copyright 2015-2026 Ritense BV, the Netherlands.
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
import {Edit16} from '@carbon/icons';
import {TranslateService} from '@ngx-translate/core';
import {CARBON_CONSTANTS} from '@valtimo/components';
import {FileItem, IconService} from 'carbon-components-angular';
import {
  BehaviorSubject,
  combineLatest,
  debounceTime,
  distinctUntilChanged,
  map,
  Observable,
  Subscription,
  take,
} from 'rxjs';
import {
  IMPORT_WARNING,
  STEPS,
  UPLOAD_STATUS,
  UPLOAD_STEP,
} from './case-management-upload.constants';
import {CaseManagementService} from '../../services';
import {CASE_MANAGEMENT_UPLOAD_TEST_IDS} from '../../constants';
import {CaseDefinitionImportPreview} from '../../models/case-deployment.model';

@Component({
  standalone: false,
  selector: 'valtimo-case-management-upload',
  templateUrl: './case-management-upload.component.html',
  styleUrls: ['./case-management-upload.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CaseManagementUploadComponent implements OnInit, OnDestroy {
  @Input() open = false;
  @Output() closeModal = new EventEmitter<boolean>();

  protected readonly testIds = CASE_MANAGEMENT_UPLOAD_TEST_IDS;

  public acceptedFiles: string[] = ['.zip'];

  public readonly UPLOAD_STEP = UPLOAD_STEP;
  public readonly UPLOAD_STATUS = UPLOAD_STATUS;
  public readonly IMPORT_WARNING = IMPORT_WARNING;

  private readonly _disabled$ = new BehaviorSubject<boolean>(true);

  public readonly activeStep$ = new BehaviorSubject<UPLOAD_STEP>(UPLOAD_STEP.PLUGINS);
  public readonly uploadStatus$ = new BehaviorSubject<UPLOAD_STATUS>(UPLOAD_STATUS.ACTIVE);
  public readonly preview$ = new BehaviorSubject<CaseDefinitionImportPreview | null>(null);
  public readonly importWarning$ = new BehaviorSubject<IMPORT_WARNING>(IMPORT_WARNING.NONE);
  public readonly editKeyActive$ = new BehaviorSubject<boolean>(false);
  public readonly overrideConfirmed$ = new BehaviorSubject<boolean>(false);

  public readonly backButtonEnabled$: Observable<boolean> = this.activeStep$.pipe(
    map((activeStep: UPLOAD_STEP) =>
      [
        UPLOAD_STEP.FILE_SELECT,
        UPLOAD_STEP.CONFIGURE,
        UPLOAD_STEP.ACCESS_CONTROL,
        UPLOAD_STEP.DASHBOARD,
      ].includes(activeStep)
    )
  );

  public readonly isStepAfterUpload$: Observable<boolean> = this.activeStep$.pipe(
    map(
      (activeStep: UPLOAD_STEP) =>
        ![UPLOAD_STEP.PLUGINS, UPLOAD_STEP.FILE_SELECT, UPLOAD_STEP.CONFIGURE].includes(activeStep)
    )
  );

  public readonly showCloseButton$: Observable<boolean> = this.activeStep$.pipe(
    map((activeStep: UPLOAD_STEP) =>
      [
        UPLOAD_STEP.PLUGINS,
        UPLOAD_STEP.FILE_SELECT,
        UPLOAD_STEP.CONFIGURE,
        UPLOAD_STEP.FILE_UPLOAD,
      ].includes(activeStep)
    )
  );

  public readonly nextButtonDisabled$: Observable<boolean> = combineLatest([
    this.activeStep$,
    this._disabled$,
    this.importWarning$,
    this.overrideConfirmed$,
  ]).pipe(
    map(([activeStep, disabled, warning, overrideConfirmed]) => {
      if (activeStep === UPLOAD_STEP.CONFIGURE) {
        if (warning === IMPORT_WARNING.EXISTING_FINAL) return true;
        if (warning === IMPORT_WARNING.EXISTING_DRAFT && !overrideConfirmed) return true;
        return this.configureForm.invalid;
      }
      return activeStep !== UPLOAD_STEP.PLUGINS && disabled;
    })
  );

  public form: FormGroup = this.fb.group({
    file: this.fb.control(new Set<any>(), [Validators.required]),
  });

  public configureForm: FormGroup = this.fb.group({
    name: this.fb.control('', Validators.required),
    caseDefinitionKey: this.fb.control({value: '', disabled: true}, [
      Validators.required,
      Validators.pattern('[A-Za-z0-9-]*'),
    ]),
  });

  private readonly _importFile$ = new BehaviorSubject<FormData | null>(null);
  private readonly _subscriptions = new Subscription();

  constructor(
    private readonly caseManagementService: CaseManagementService,
    private readonly fb: FormBuilder,
    private readonly iconService: IconService,
    private readonly translateService: TranslateService
  ) {
    this.iconService.register(Edit16);
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
          if (this.activeStep$.value === UPLOAD_STEP.FILE_SELECT) {
            this.preview$.next(null);
          }
          return;
        }

        this.setZipFile(fileItem);
      })
    );

    this._subscriptions.add(
      this.configureForm
        .get('caseDefinitionKey')
        .valueChanges.pipe(debounceTime(400), distinctUntilChanged())
        .subscribe((key: string) => {
          this.checkExistingVersions(key);
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

    this.activeStep$.next(STEPS[nextIndex]);
    if (STEPS[nextIndex] !== UPLOAD_STEP.FILE_UPLOAD) {
      return;
    }

    this.uploadDefinition();
  }

  public onNameFocusOut(): void {
    const name = this.configureForm.get('name')?.value;
    if (!name || this.editKeyActive$.value) return;
    const derivedKey = name
      .replace(/[\W_]+/g, '-')
      .replace(/-$/, '')
      .toLowerCase();
    this.configureForm.get('caseDefinitionKey')?.patchValue(derivedKey);
  }

  public enableKeyEdit(): void {
    this.editKeyActive$.next(true);
    this.configureForm.get('caseDefinitionKey')?.enable();
  }

  private setZipFile(fileItem: FileItem): void {
    const file = fileItem?.file;

    if (!file) {
      this._importFile$.next(null);
      this.preview$.next(null);
      return;
    }

    const blob = new Blob([file], {type: file.type});
    const fd = new FormData();
    fd.append('file', blob, file.name);
    this._importFile$.next(fd);

    this.caseManagementService
      .previewImport(fd)
      .pipe(take(1))
      .subscribe({
        next: preview => {
          this.preview$.next(preview);
          this.configureForm.patchValue({
            name: preview.name,
            caseDefinitionKey: preview.key,
          });
          this._disabled$.next(false);
          this.checkExistingVersions(preview.key);
        },
        error: () => {
          this._disabled$.next(true);
          fileItem.invalid = true;
          fileItem.invalidTitle = this.translateService.instant(
            'caseManagement.importDefinition.invalidZipError.title'
          );
          fileItem.invalidText = this.translateService.instant(
            'caseManagement.importDefinition.invalidZipError.text'
          );
        },
      });
  }

  private checkExistingVersions(key: string): void {
    if (!key) {
      this.importWarning$.next(IMPORT_WARNING.NONE);
      return;
    }

    this.caseManagementService
      .getCaseDefinitionVersions(key)
      .pipe(take(1))
      .subscribe({
        next: versions => this.determineWarning(versions),
        error: () => this.importWarning$.next(IMPORT_WARNING.NONE),
      });
  }

  private determineWarning(versions: any[]): void {
    const preview = this.preview$.value;
    if (!preview || versions.length === 0) {
      this.importWarning$.next(IMPORT_WARNING.NONE);
      return;
    }

    const matchingVersion = versions.find(v => v.versionTag === preview.versionTag);
    if (!matchingVersion) {
      this.importWarning$.next(IMPORT_WARNING.NEW_VERSION);
      return;
    }

    if (matchingVersion.final) {
      this.importWarning$.next(IMPORT_WARNING.EXISTING_FINAL);
      return;
    }

    this.importWarning$.next(IMPORT_WARNING.EXISTING_DRAFT);
    this.overrideConfirmed$.next(false);
  }

  private uploadDefinition(): void {
    this._disabled$.next(true);
    const file = this._importFile$.value;
    if (!file) return;

    const {name, caseDefinitionKey} = this.configureForm.getRawValue();
    const preview = this.preview$.value;

    const keyChanged = caseDefinitionKey !== preview?.key;
    const nameChanged = name !== preview?.name;
    const hasOverrides = keyChanged || nameChanged;

    this.caseManagementService
      .importDocumentDefinitionZip(
        file,
        hasOverrides ? caseDefinitionKey : undefined,
        hasOverrides ? name : undefined
      )
      .pipe(take(1))
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

  private resetModal(): void {
    setTimeout(() => {
      this.activeStep$.next(UPLOAD_STEP.PLUGINS);
      this.uploadStatus$.next(UPLOAD_STATUS.ACTIVE);
      this.form.reset({file: new Set<any>()});
      this.configureForm.reset();
      this._importFile$.next(null);
      this._disabled$.next(true);
      this.preview$.next(null);
      this.importWarning$.next(IMPORT_WARNING.NONE);
      this.overrideConfirmed$.next(false);
      this.editKeyActive$.next(false);
    }, CARBON_CONSTANTS.modalAnimationMs);
  }
}
