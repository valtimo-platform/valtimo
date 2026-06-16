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
  EventEmitter,
  Input,
  OnChanges,
  Output,
  signal,
  SimpleChanges,
} from '@angular/core';
import {TranslateModule} from '@ngx-translate/core';
import {PermissionService} from '@valtimo/access-control';
import {CheckmarkFilled16, CheckmarkOutline16, WarningAltFilled16} from '@carbon/icons';
import {IconModule, IconService, LoadingModule, TagModule} from 'carbon-components-angular';
import {CaseInspectionProcessDetailComponent} from './process-detail/process-detail.component';
import {CaseInspectionService} from '../../../services';
import {BuildingBlockProcessReference, ProcessInstanceInspection} from '../../../models';
import {
  CAN_INSPECT_MODIFY_CASE_PERMISSION,
  CASE_DETAIL_PERMISSION_RESOURCE,
} from '../../../permissions';

@Component({
  standalone: true,
  selector: 'valtimo-case-inspection-processes',
  templateUrl: './processes-tab.component.html',
  styleUrl: './processes-tab.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    TranslateModule,
    IconModule,
    TagModule,
    CaseInspectionProcessDetailComponent,
    LoadingModule,
  ],
})
export class CaseInspectionProcessesTabComponent implements OnChanges {
  @Input() public documentId!: string;

  @Output() public readonly viewBuildingBlockEvent =
    new EventEmitter<BuildingBlockProcessReference>();
  @Output() public readonly viewProcessLogsEvent = new EventEmitter<string>();

  public readonly $loading = signal<boolean>(true);
  public readonly $rows = signal<ProcessInstanceInspection[]>([]);
  public readonly $errorMessage = signal<string | null>(null);
  public readonly $selected = signal<ProcessInstanceInspection | null>(null);
  public readonly $canInspectModify = signal<boolean>(false);

  constructor(
    private readonly caseInspectionService: CaseInspectionService,
    private readonly permissionService: PermissionService,
    private readonly iconService: IconService
  ) {
    this.iconService.registerAll([WarningAltFilled16, CheckmarkFilled16, CheckmarkOutline16]);
  }

  public ngOnChanges(changes: SimpleChanges): void {
    if (changes.documentId && this.documentId) {
      this.load();
      this.loadPermission();
    }
  }

  public onSelect(row: ProcessInstanceInspection): void {
    this.$selected.set(row);
  }

  public isSelected(row: ProcessInstanceInspection): boolean {
    return this.$selected()?.processInstanceId === row.processInstanceId;
  }

  public reloadSelected(): void {
    const selectedId = this.$selected()?.processInstanceId;
    this.caseInspectionService.getProcessInspection(this.documentId).subscribe({
      next: rows => {
        this.$rows.set(rows);
        const next = rows.find(r => r.processInstanceId === selectedId) ?? rows[0] ?? null;
        this.$selected.set(next);
      },
      error: err => {
        this.$errorMessage.set(err?.error?.message ?? err?.message ?? 'Failed to reload processes');
      },
    });
  }

  private load(): void {
    const requestedDocumentId = this.documentId;
    this.$loading.set(true);
    this.$errorMessage.set(null);
    this.$selected.set(null);
    this.$rows.set([]);

    this.caseInspectionService.getProcessInspection(requestedDocumentId).subscribe({
      next: rows => {
        if (requestedDocumentId !== this.documentId) {
          return;
        }
        this.$rows.set(rows);
        if (rows.length > 0) {
          this.$selected.set(rows[0]);
        }
        this.$loading.set(false);
      },
      error: err => {
        if (requestedDocumentId !== this.documentId) {
          return;
        }
        this.$errorMessage.set(err?.error?.message ?? err?.message ?? 'Failed to load processes');
        this.$loading.set(false);
      },
    });
  }

  private loadPermission(): void {
    this.$canInspectModify.set(false);
    this.permissionService
      .requestPermission(CAN_INSPECT_MODIFY_CASE_PERMISSION, {
        resource: CASE_DETAIL_PERMISSION_RESOURCE.jsonSchemaDocument,
        identifier: this.documentId,
      })
      .subscribe({
        next: allowed => this.$canInspectModify.set(allowed),
        error: () => this.$canInspectModify.set(false),
      });
  }
}
