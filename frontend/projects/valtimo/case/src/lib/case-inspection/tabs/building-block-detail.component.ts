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

import {CommonModule} from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  Input,
  OnChanges,
  signal,
  SimpleChanges,
} from '@angular/core';
import {TranslateModule, TranslateService} from '@ngx-translate/core';
import {PermissionService} from '@valtimo/access-control';
import {EditorModel, JsonEditorComponent} from '@valtimo/components';
import {GlobalNotificationService} from '@valtimo/shared';
import {BehaviorSubject} from 'rxjs';
import {
  CAN_INSPECT_MODIFY_CASE_PERMISSION,
  CASE_DETAIL_PERMISSION_RESOURCE,
} from '../../permissions/case-detail.permissions';
import {BuildingBlockInstance, DocumentInspection} from '../models/case-inspection.models';
import {CaseInspectionService} from '../services/case-inspection.service';

@Component({
  standalone: true,
  selector: 'valtimo-case-inspection-building-block-detail',
  templateUrl: './building-block-detail.component.html',
  styleUrl: './building-block-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, TranslateModule, JsonEditorComponent],
})
export class CaseInspectionBuildingBlockDetailComponent implements OnChanges {
  @Input() public instance!: BuildingBlockInstance;

  public readonly $loading = signal<boolean>(true);
  public readonly $errorMessage = signal<string | null>(null);
  public readonly $canInspectModify = signal<boolean>(false);
  public readonly $document = signal<DocumentInspection | null>(null);
  public readonly model$ = new BehaviorSubject<EditorModel | null>(null);

  constructor(
    private readonly caseInspectionService: CaseInspectionService,
    private readonly permissionService: PermissionService,
    private readonly notificationService: GlobalNotificationService,
    private readonly translateService: TranslateService
  ) {}

  public ngOnChanges(changes: SimpleChanges): void {
    if (changes.instance && this.instance) {
      this.loadDocument();
      this.loadPermission();
    }
  }

  public onSaveEvent(content: object): void {
    this.caseInspectionService
      .modifyDocumentForInspection(this.instance.documentId, {
        documentId: this.instance.documentId,
        content,
      })
      .subscribe({
        next: result => {
          if (result.errors?.length) {
            this.$errorMessage.set(result.errors.join('\n'));
            return;
          }
          this.$errorMessage.set(null);
          this.notificationService.showToast({
            type: 'success',
            title: this.translateService.instant('case.inspection.buildingBlocks.saved'),
            message: '',
          });
          this.loadDocument();
        },
        error: err => {
          this.$errorMessage.set(err?.error?.message ?? err?.message ?? 'Save failed');
        },
      });
  }

  private loadDocument(): void {
    this.$loading.set(true);
    this.$errorMessage.set(null);
    this.caseInspectionService.getDocument(this.instance.documentId).subscribe({
      next: document => {
        this.$document.set(document);
        this.model$.next({
          value: JSON.stringify(document.content ?? {}, null, 2),
          language: 'json',
        });
        this.$loading.set(false);
      },
      error: err => {
        this.$errorMessage.set(
          err?.error?.message ?? err?.message ?? 'Failed to load building block'
        );
        this.$loading.set(false);
      },
    });
  }

  private loadPermission(): void {
    this.permissionService
      .requestPermission(CAN_INSPECT_MODIFY_CASE_PERMISSION, {
        resource: CASE_DETAIL_PERMISSION_RESOURCE.jsonSchemaDocument,
        identifier: this.instance.documentId,
      })
      .subscribe((allowed: boolean) => this.$canInspectModify.set(allowed));
  }
}
