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
import {CheckmarkFilled16, CheckmarkOutline16, WarningAltFilled16} from '@carbon/icons';
import {IconModule, IconService} from 'carbon-components-angular';
import {CaseInspectionProcessDetailComponent} from './process-detail.component';
import {CaseInspectionService} from '../services/case-inspection.service';
import {
  BuildingBlockProcessReference,
  ProcessInstanceInspection,
} from '../models/case-inspection.models';

@Component({
  standalone: true,
  selector: 'valtimo-case-inspection-processes',
  templateUrl: './processes-tab.component.html',
  styleUrl: './processes-tab.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, TranslateModule, IconModule, CaseInspectionProcessDetailComponent],
})
export class CaseInspectionProcessesTabComponent implements OnChanges {
  @Input() public documentId!: string;

  @Output() public readonly viewBuildingBlockEvent =
    new EventEmitter<BuildingBlockProcessReference>();

  public readonly $loading = signal<boolean>(true);
  public readonly $rows = signal<ProcessInstanceInspection[]>([]);
  public readonly $errorMessage = signal<string | null>(null);
  public readonly $selected = signal<ProcessInstanceInspection | null>(null);

  constructor(
    private readonly caseInspectionService: CaseInspectionService,
    private readonly iconService: IconService
  ) {
    this.iconService.registerAll([WarningAltFilled16, CheckmarkFilled16, CheckmarkOutline16]);
  }

  public ngOnChanges(changes: SimpleChanges): void {
    if (changes.documentId && this.documentId) {
      this.load();
    }
  }

  public onSelect(row: ProcessInstanceInspection): void {
    this.$selected.set(row);
  }

  public isSelected(row: ProcessInstanceInspection): boolean {
    return this.$selected()?.processInstanceId === row.processInstanceId;
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
}
