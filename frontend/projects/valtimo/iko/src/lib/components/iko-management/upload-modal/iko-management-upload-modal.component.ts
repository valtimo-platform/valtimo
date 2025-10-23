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
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
} from '@angular/core';
import {CommonModule} from '@angular/common';
import {TranslateModule, TranslateService} from '@ngx-translate/core';
import {
  ButtonModule,
  CheckboxModule,
  FileItem,
  FileUploaderModule,
  IconModule,
  InputModule,
  ModalModule,
  NotificationContent,
  NotificationModule,
  ProgressBarModule,
} from 'carbon-components-angular';
import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import {CARBON_CONSTANTS, ValtimoCdsModalDirective} from '@valtimo/components';
import {BehaviorSubject, combineLatest, map, Observable, Subscription, switchMap, take} from 'rxjs';
import {UPLOAD_STEP, STEPS, UPLOAD_STATUS} from './iko-management-upload.constants';
import {IkoManagementApiService} from '../../../services';
import {IkoManagementUploadStepComponent} from './step/iko-management-upload-step.component';

@Component({
  standalone: true,
  selector: 'valtimo-iko-management-upload-modal',
  templateUrl: './iko-management-upload-modal.component.html',
  styleUrls: ['./iko-management-upload-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    TranslateModule,
    ModalModule,
    ValtimoCdsModalDirective,
    InputModule,
    ReactiveFormsModule,
    ButtonModule,
    IconModule,
    ProgressBarModule,
    CheckboxModule,
    FileUploaderModule,
    IkoManagementUploadStepComponent,
    NotificationModule,
    TranslateModule,
  ],
})
export class IkoManagementUploadModalComponent implements OnInit, OnDestroy {
  private readonly _open$ = new BehaviorSubject<boolean>(false);

  @Input() public set open(value: boolean) {
    this._open$.next(value);

    if (!value) this.resetForm();
  }

  public get open$(): Observable<boolean> {
    return this._open$.asObservable();
  }

  @Output() modalClose = new EventEmitter<boolean>();

  public readonly showCheckboxError$ = new BehaviorSubject<boolean>(false);
  public readonly activeStep$ = new BehaviorSubject<UPLOAD_STEP>(UPLOAD_STEP.FILE_SELECT);
  public readonly backButtonEnabled$: Observable<boolean> = this.activeStep$.pipe(
    map((activeStep: UPLOAD_STEP) => [UPLOAD_STEP.ACCESS_CONTROL].includes(activeStep))
  );

  private readonly _disabled$ = new BehaviorSubject<boolean>(true);

  public readonly uploadStatus$ = new BehaviorSubject<UPLOAD_STATUS>(UPLOAD_STATUS.ACTIVE);

  public readonly nextButtonDisabled$: Observable<boolean> = combineLatest([
    this.activeStep$,
    this._disabled$,
    this.uploadStatus$,
  ]).pipe(
    map(([activeStep, disabled, status]) =>
      activeStep === UPLOAD_STEP.FILE_UPLOAD ? status !== UPLOAD_STATUS.FINISHED : disabled
    )
  );

  public readonly isStepAfterUpload$: Observable<boolean> = this.activeStep$.pipe(
    map((activeStep: UPLOAD_STEP) => ![UPLOAD_STEP.FILE_SELECT].includes(activeStep))
  );

  public readonly notificationObj$: Observable<NotificationContent> = combineLatest([
    this.translateService.stream('interface.warning'),
    this.translateService.stream('caseManagement.importDefinition.overwriteWarning'),
  ]).pipe(
    map(([title, message]) => ({
      type: 'warning',
      title,
      message,
      showClose: false,
      lowContrast: true,
    }))
  );

  public readonly showCloseButton$: Observable<boolean> = this.activeStep$.pipe(
    map((activeStep: UPLOAD_STEP) =>
      [UPLOAD_STEP.FILE_SELECT, UPLOAD_STEP.FILE_UPLOAD].includes(activeStep)
    )
  );

  public acceptedFiles: string[] = ['.zip'];
  public selectedFile: File | null;

  public readonly UPLOAD_STATUS = UPLOAD_STATUS;
  public readonly UPLOAD_STEP = UPLOAD_STEP;
  private readonly _subscriptions = new Subscription();
  private readonly _importFile$ = new BehaviorSubject<string | FormData>('');

  public form: FormGroup = this.fb.group({
    file: this.fb.control(new Set<any>(), [Validators.required]),
  });

  private _checked = false;

  constructor(
    private readonly fb: FormBuilder,
    private readonly translateService: TranslateService,
    private readonly ikoManagementApiService: IkoManagementApiService
  ) {}

  ngOnInit(): void {
    const control: AbstractControl | null = this.form.get('file');
    if (!control) return;

    this._subscriptions.add(
      control.valueChanges.subscribe((fileSet: Set<FileItem>) => {
        const [fileItem] = fileSet;
        if (!fileItem) {
          this._disabled$.next(true);
          this.showCheckboxError$.next(false);
          this._checked = false;
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

  public onBackClick(activeStep: UPLOAD_STEP): void {
    const prevIndex: number = STEPS.findIndex((step: UPLOAD_STEP) => step === activeStep) - 1;
    if (prevIndex === -1) {
      return;
    }

    this.activeStep$.next(STEPS[prevIndex]);
  }

  public onCloseModal(definitionUploaded?: boolean): void {
    this.modalClose.emit(definitionUploaded ?? false);
    this.resetModal();
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

    this.showCheckboxError$.next(false);
    this.activeStep$.next(STEPS[nextIndex]);

    if (STEPS[nextIndex] === UPLOAD_STEP.FILE_UPLOAD) {
      this.uploadDefinition();
    }
  }

  public onCheckedChange(checked: boolean): void {
    this._checked = checked;

    if (!checked) {
      return;
    }

    this.showCheckboxError$.next(false);
  }

  public onCancel(): void {
    this.modalClose.emit(false);
  }

  private uploadDefinition(): void {
    this._disabled$.next(true);
    this._importFile$
      .pipe(
        switchMap((file: any) => this.ikoManagementApiService.importConfigurationZip(file)),
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

  private setZipFile(fileItem: FileItem): void {
    const blob = new Blob([fileItem.file], {type: fileItem.file.type});
    const fd = new FormData();
    fd.append('file', blob, fileItem.file.name);
    this._importFile$.next(fd);
    this._disabled$.next(false);
  }

  private resetForm(): void {
    this.form.reset();
  }

  private resetModal(): void {
    setTimeout(() => {
      this.resetForm();
      this.activeStep$.next(UPLOAD_STEP.FILE_SELECT);
      this.uploadStatus$.next(UPLOAD_STATUS.ACTIVE);
      this.showCheckboxError$.next(false);
      this._disabled$.next(true);
    }, CARBON_CONSTANTS.modalAnimationMs);
  }
}
