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
import {TranslateModule} from '@ngx-translate/core';
import {StructuredListModule, TagModule} from 'carbon-components-angular';
import {DocumentInspection} from '../models/case-inspection.models';
import {CaseInspectionService} from '../services/case-inspection.service';

@Component({
  standalone: true,
  selector: 'valtimo-case-inspection-metadata',
  templateUrl: './metadata-tab.component.html',
  styleUrl: './metadata-tab.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, TranslateModule, StructuredListModule, TagModule],
})
export class CaseInspectionMetadataTabComponent implements OnChanges {
  @Input() public documentId!: string;

  public readonly $loading = signal<boolean>(true);
  public readonly $document = signal<DocumentInspection | null>(null);
  public readonly $errorMessage = signal<string | null>(null);

  constructor(private readonly caseInspectionService: CaseInspectionService) {}

  public ngOnChanges(changes: SimpleChanges): void {
    if (changes.documentId && this.documentId) {
      this.loadDocument();
    }
  }

  private loadDocument(): void {
    this.$loading.set(true);
    this.$errorMessage.set(null);
    this.caseInspectionService.getDocument(this.documentId).subscribe({
      next: document => {
        this.$document.set(document);
        this.$loading.set(false);
      },
      error: err => {
        this.$errorMessage.set(err?.error?.message ?? err?.message ?? 'Failed to load metadata');
        this.$loading.set(false);
      },
    });
  }
}
