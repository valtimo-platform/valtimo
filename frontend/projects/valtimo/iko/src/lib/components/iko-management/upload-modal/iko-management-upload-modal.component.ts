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
import {ChangeDetectionStrategy, Component, EventEmitter, Input, OnDestroy, OnInit, Output} from '@angular/core';
import {CommonModule} from '@angular/common';
import {TranslateModule} from '@ngx-translate/core';
import {ButtonModule, IconModule, InputModule, ModalModule, ProgressBarModule} from 'carbon-components-angular';
import {AbstractControl, FormBuilder, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';
import {PropertiesFormComponent} from '../../iko-management-properties/iko-management-properties.component';
import {CARBON_CONSTANTS, ValtimoCdsModalDirective} from '@valtimo/components';
import {BehaviorSubject, map, Observable, Subscription} from 'rxjs';
import {UPLOAD_STEP, STEPS, UPLOAD_STATUS} from './iko-management-upload.constants';

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
    PropertiesFormComponent,
    ProgressBarModule,
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

  public readonly activeStep$ = new BehaviorSubject<UPLOAD_STEP>(UPLOAD_STEP.FILE_SELECT);
  public readonly backButtonEnabled$: Observable<boolean> = this.activeStep$.pipe(
    map((activeStep: UPLOAD_STEP) =>
      [UPLOAD_STEP.FILE_SELECT].includes(
        activeStep
      )
    )
  );

  public readonly uploadStatus$ = new BehaviorSubject<UPLOAD_STATUS>(UPLOAD_STATUS.ACTIVE);

  private readonly _subscriptions = new Subscription();
  private readonly _importFile$ = new BehaviorSubject<string | FormData>('');

  public form: FormGroup = this.fb.group({
    file: this.fb.control(new Set<any>(), [Validators.required]),
  });

  constructor(
    private readonly fb: FormBuilder,
  ) {}

  public ngOnInit(): void {
    const control: AbstractControl | null = this.form.get('file');
    if (!control) {
      return;
    }
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

  public resetForm(): void {
    console.log("reset form called");
  }

  public onCancel(): void {
    this.modalClose.emit(false);
  }

  private resetModal(): void {
    setTimeout(() => {
      this.activeStep$.next(UPLOAD_STEP.FILE_SELECT);
      this.uploadStatus$.next(UPLOAD_STATUS.ACTIVE);
     // this.showCheckboxError$.next(false);
    }, CARBON_CONSTANTS.modalAnimationMs);
  }
}
