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
import {HttpErrorResponse} from '@angular/common/http';
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
import {CarbonListModule} from '@valtimo/components';
import {CaseInspectionBuildingBlockDetailComponent} from './building-block-detail.component';
import {BuildingBlockInstance} from '../models/case-inspection.models';
import {CaseInspectionService} from '../services/case-inspection.service';

@Component({
  standalone: true,
  selector: 'valtimo-case-inspection-building-blocks',
  templateUrl: './building-blocks-tab.component.html',
  styleUrl: './building-blocks-tab.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CarbonListModule,
    CaseInspectionBuildingBlockDetailComponent,
    CommonModule,
    TranslateModule,
  ],
})
export class CaseInspectionBuildingBlocksTabComponent implements OnChanges {
  @Input() public documentId!: string;
  @Input() public pendingInstanceId: string | null = null;

  @Output() public readonly viewProcessLogsEvent = new EventEmitter<string>();

  public readonly $loading = signal<boolean>(true);
  public readonly $instances = signal<BuildingBlockInstance[]>([]);
  public readonly $errorMessage = signal<string | null>(null);
  public readonly $notSupported = signal<boolean>(false);
  public readonly $selected = signal<BuildingBlockInstance | null>(null);

  constructor(private readonly caseInspectionService: CaseInspectionService) {}

  public ngOnChanges(changes: SimpleChanges): void {
    if (changes.documentId && this.documentId) {
      this.load();
      return;
    }
    if (changes.pendingInstanceId && this.pendingInstanceId) {
      this.applyPendingSelection();
    }
  }

  public onSelect(instance: BuildingBlockInstance): void {
    this.$selected.set(instance);
  }

  public isSelected(instance: BuildingBlockInstance): boolean {
    return this.$selected()?.id === instance.id;
  }

  private load(): void {
    const requestedDocumentId = this.documentId;
    this.$loading.set(true);
    this.$errorMessage.set(null);
    this.$notSupported.set(false);
    this.$selected.set(null);
    this.$instances.set([]);

    this.caseInspectionService.getBuildingBlockInstances(requestedDocumentId).subscribe({
      next: instances => {
        if (requestedDocumentId !== this.documentId) {
          return;
        }
        this.$instances.set(instances);
        if (instances.length > 0) {
          this.$selected.set(this.findMatchingInstance(instances) ?? instances[0]);
        }
        this.$loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        if (requestedDocumentId !== this.documentId) {
          return;
        }
        if (err.status === 404) {
          this.$notSupported.set(true);
        } else {
          this.$errorMessage.set(
            err?.error?.message ?? err?.message ?? 'Failed to load building blocks'
          );
        }
        this.$instances.set([]);
        this.$loading.set(false);
      },
    });
  }

  private applyPendingSelection(): void {
    const instances = this.$instances();
    if (!instances.length) {
      return;
    }
    const match = this.findMatchingInstance(instances);
    if (match) {
      this.$selected.set(match);
    }
  }

  private findMatchingInstance(
    instances: BuildingBlockInstance[]
  ): BuildingBlockInstance | undefined {
    if (!this.pendingInstanceId) {
      return undefined;
    }
    return instances.find(instance => instance.id === this.pendingInstanceId);
  }
}
