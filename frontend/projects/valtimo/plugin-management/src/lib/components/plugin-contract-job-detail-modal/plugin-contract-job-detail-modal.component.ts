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
  OnChanges,
  Output,
  signal,
  SimpleChanges,
} from '@angular/core';
import {CommonModule} from '@angular/common';
import {TranslateModule} from '@ngx-translate/core';
import {
  ButtonModule,
  LoadingModule,
  ModalModule,
  StructuredListModule,
  TagModule,
} from 'carbon-components-angular';
import {ValtimoCdsModalDirective} from '@valtimo/components';
import {ExternalPluginContractJobDetail, ExternalPluginService} from '@valtimo/plugin';
import {Subscription} from 'rxjs';
import {PLUGIN_CONTRACT_JOB_DETAIL_MODAL_TEST_IDS} from '../../constants';
import {contractJobStatusTagType} from '../../utils';

/** Read-only view of one contract job ledger row, including its request and result JSON. */
@Component({
  standalone: true,
  selector: 'valtimo-plugin-contract-job-detail-modal',
  templateUrl: './plugin-contract-job-detail-modal.component.html',
  styleUrls: ['./plugin-contract-job-detail-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    TranslateModule,
    ButtonModule,
    LoadingModule,
    ModalModule,
    StructuredListModule,
    TagModule,
    ValtimoCdsModalDirective,
  ],
})
export class PluginContractJobDetailModalComponent implements OnChanges {
  @Input() public open = false;
  @Input() public jobId: string | null = null;

  @Output() public closeEvent = new EventEmitter<void>();

  public readonly $job = signal<ExternalPluginContractJobDetail | null>(null);
  public readonly $loading = signal(false);

  public readonly DATE_FORMAT = 'dd-MM-yyyy HH:mm:ss';

  protected readonly testIds = PLUGIN_CONTRACT_JOB_DETAIL_MODAL_TEST_IDS;

  private _loadSubscription: Subscription | null = null;

  constructor(private readonly _externalPluginService: ExternalPluginService) {}

  public ngOnChanges(changes: SimpleChanges): void {
    if ((changes['open'] || changes['jobId']) && this.open && this.jobId) {
      this._load(this.jobId);
    }
  }

  public onClose(): void {
    this.closeEvent.emit();
  }

  public formatJson(value: unknown): string {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') {
      try {
        return JSON.stringify(JSON.parse(value), null, 2);
      } catch {
        return value;
      }
    }
    return JSON.stringify(value, null, 2);
  }

  public statusTagType(status: string): string {
    return contractJobStatusTagType(status);
  }

  private _load(jobId: string): void {
    this._loadSubscription?.unsubscribe();
    this.$job.set(null);
    this.$loading.set(true);
    this._loadSubscription = this._externalPluginService.getContractJob(jobId).subscribe({
      next: job => {
        this.$job.set(job);
        this.$loading.set(false);
      },
      error: () => this.$loading.set(false),
    });
  }
}
