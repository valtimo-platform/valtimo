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
  signal,
} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormBuilder, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';
import {WarningFilled16} from '@carbon/icons';
import {TranslateModule, TranslateService} from '@ngx-translate/core';
import {runAfterCarbonModalClosed, ValtimoCdsModalDirective} from '@valtimo/components';
import {GlobalNotificationService} from '@valtimo/shared';
import {
  ButtonModule,
  CheckboxModule,
  FileItem,
  FileUploaderModule,
  IconModule,
  IconService,
  ModalModule,
  NotificationModule,
} from 'carbon-components-angular';
import {Subscription} from 'rxjs';
import {CaseDefinitionGroupManagementService} from '../../services';
import {CASE_DEFINITION_GROUP_IMPORT_MODAL_TEST_IDS} from '../../constants';

@Component({
  standalone: true,
  selector: 'valtimo-case-definition-group-import-modal',
  templateUrl: './case-definition-group-import-modal.component.html',
  styleUrls: ['./case-definition-group-import-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TranslateModule,
    ButtonModule,
    CheckboxModule,
    FileUploaderModule,
    IconModule,
    ModalModule,
    NotificationModule,
    ValtimoCdsModalDirective,
  ],
})
export class CaseDefinitionGroupImportModalComponent implements OnInit, OnDestroy {
  @Input() open = false;
  @Output() closeEvent = new EventEmitter<boolean>();

  protected readonly testIds = CASE_DEFINITION_GROUP_IMPORT_MODAL_TEST_IDS;

  public readonly ACCEPTED_FILES: string[] = ['.zip'];

  public readonly form: FormGroup = this.fb.group({
    file: this.fb.control(new Set<FileItem>(), Validators.required),
    overwriteConfirmed: this.fb.control(false),
  });

  public readonly $hasFile = signal(false);
  public readonly $importError = signal(false);
  public readonly $importing = signal(false);
  public readonly $showConfirmError = signal(false);

  private readonly _subscriptions = new Subscription();

  constructor(
    private readonly fb: FormBuilder,
    private readonly groupService: CaseDefinitionGroupManagementService,
    private readonly iconService: IconService,
    private readonly notificationService: GlobalNotificationService,
    private readonly translateService: TranslateService
  ) {
    this.iconService.register(WarningFilled16);
  }

  public ngOnInit(): void {
    this._subscriptions.add(
      this.form.get('file')?.valueChanges.subscribe((fileSet: Set<FileItem>) => {
        this.$hasFile.set(!!this.getFile(fileSet));
        this.$importError.set(false);
      })
    );

    this._subscriptions.add(
      this.form.get('overwriteConfirmed')?.valueChanges.subscribe((confirmed: boolean) => {
        if (confirmed) this.$showConfirmError.set(false);
      })
    );
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  public onCloseModal(imported = false): void {
    this.closeEvent.emit(imported);
    runAfterCarbonModalClosed(() => this.resetModal());
  }

  public onImport(): void {
    const file = this.getFile(this.form.get('file')?.value);
    if (!file) return;

    if (!this.form.get('overwriteConfirmed')?.value) {
      this.$showConfirmError.set(true);
      return;
    }

    const formData = new FormData();
    formData.append('file', file, file.name);

    this.$importing.set(true);
    this.$importError.set(false);

    this.groupService.importGroup(formData).subscribe({
      next: () => {
        this.$importing.set(false);
        this.notificationService.showNotification({
          type: 'success',
          title: this.translateService.instant('caseManagement.groups.import.successTitle'),
          duration: 5000,
        });
        this.onCloseModal(true);
      },
      error: () => {
        this.$importing.set(false);
        this.$importError.set(true);
      },
    });
  }

  private getFile(fileSet: Set<FileItem> | null | undefined): File | null {
    if (!fileSet) return null;
    const [fileItem] = Array.from(fileSet);
    return fileItem?.file ?? null;
  }

  private resetModal(): void {
    this.form.reset({file: new Set<FileItem>(), overwriteConfirmed: false});
    this.$hasFile.set(false);
    this.$importError.set(false);
    this.$importing.set(false);
    this.$showConfirmError.set(false);
  }
}
