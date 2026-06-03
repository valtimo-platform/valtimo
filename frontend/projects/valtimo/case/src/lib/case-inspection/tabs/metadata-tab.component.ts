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
  computed,
  Input,
  OnChanges,
  signal,
  SimpleChanges,
} from '@angular/core';
import {TranslateModule} from '@ngx-translate/core';
import {TagModule} from 'carbon-components-angular';
import {CaseTag} from '@valtimo/document';
import {DocumentInspection} from '../models/case-inspection.models';
import {CaseInspectionService} from '../services/case-inspection.service';

type MetadataField =
  | {label: string; type: 'code'; value: string | null | undefined}
  | {label: string; type: 'text'; value: string | number | null | undefined; emptyKey?: string}
  | {label: string; type: 'date'; value: string | null | undefined}
  | {label: string; type: 'tags'; value: CaseTag[] | undefined; emptyKey: string}
  | {label: string; type: 'relations'; value: string[] | undefined; emptyKey: string}
  | {label: string; type: 'count'; value: unknown[] | undefined};

@Component({
  standalone: true,
  selector: 'valtimo-case-inspection-metadata',
  templateUrl: './metadata-tab.component.html',
  styleUrl: './metadata-tab.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, TranslateModule, TagModule],
})
export class CaseInspectionMetadataTabComponent implements OnChanges {
  @Input() public documentId!: string;

  public readonly $loading = signal<boolean>(true);
  public readonly $document = signal<DocumentInspection | null>(null);
  public readonly $errorMessage = signal<string | null>(null);

  public readonly $fields = computed<MetadataField[]>(() => {
    const doc = this.$document();
    if (!doc) return [];
    return [
      {label: 'case.inspection.metadata.documentId', type: 'code', value: doc.id},
      {
        label: 'case.inspection.metadata.definitionName',
        type: 'text',
        value: doc.definitionId?.name,
      },
      {label: 'case.inspection.metadata.sequence', type: 'text', value: doc.sequence},
      {label: 'case.inspection.metadata.version', type: 'text', value: doc.version},
      {label: 'case.inspection.metadata.createdBy', type: 'text', value: doc.createdBy},
      {label: 'case.inspection.metadata.createdOn', type: 'date', value: doc.createdOn},
      {label: 'case.inspection.metadata.modifiedOn', type: 'date', value: doc.modifiedOn},
      {
        label: 'case.inspection.metadata.assignee',
        type: 'text',
        value: doc.assigneeFullName,
        emptyKey: 'case.inspection.metadata.unassigned',
      },
      {
        label: 'case.inspection.metadata.assignedTeam',
        type: 'text',
        value: doc.assignedTeamTitle,
        emptyKey: 'case.inspection.metadata.unassigned',
      },
      {
        label: 'case.inspection.metadata.internalStatus',
        type: 'text',
        value: doc.internalStatus,
        emptyKey: 'case.inspection.metadata.noStatus',
      },
      {
        label: 'case.inspection.metadata.tags',
        type: 'tags',
        value: doc.caseTags,
        emptyKey: 'case.inspection.metadata.noTags',
      },
      {
        label: 'case.inspection.metadata.relations',
        type: 'relations',
        value: doc.relations,
        emptyKey: 'case.inspection.metadata.noRelations',
      },
      {label: 'case.inspection.metadata.relatedFiles', type: 'count', value: doc.relatedFiles},
    ];
  });

  constructor(private readonly caseInspectionService: CaseInspectionService) {}

  public ngOnChanges(changes: SimpleChanges): void {
    if (changes.documentId && this.documentId) {
      this.loadDocument(this.documentId);
    }
  }

  private loadDocument(documentId: string): void {
    this.$loading.set(true);
    this.$errorMessage.set(null);
    this.$document.set(null);
    this.caseInspectionService.getDocument(documentId).subscribe({
      next: document => {
        if (documentId !== this.documentId) {
          return;
        }
        this.$document.set(document);
        this.$loading.set(false);
      },
      error: err => {
        if (documentId !== this.documentId) {
          return;
        }
        this.$document.set(null);
        this.$errorMessage.set(err?.error?.message ?? err?.message ?? 'Failed to load metadata');
        this.$loading.set(false);
      },
    });
  }
}
