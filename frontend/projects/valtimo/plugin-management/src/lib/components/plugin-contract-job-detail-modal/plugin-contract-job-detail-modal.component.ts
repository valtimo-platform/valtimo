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
  computed,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  signal,
  SimpleChanges,
} from '@angular/core';
import {CommonModule} from '@angular/common';
import {HttpErrorResponse} from '@angular/common/http';
import {TranslateModule} from '@ngx-translate/core';
import {
  ButtonModule,
  LoadingModule,
  ModalButtonType,
  ModalModule,
  NotificationModule,
  StructuredListModule,
  TagModule,
} from 'carbon-components-angular';
import {ConfirmationModalModule, ValtimoCdsModalDirective} from '@valtimo/components';
import {
  ExternalPluginContractJobDetail,
  ExternalPluginContractJobPayload,
  ExternalPluginService,
} from '@valtimo/plugin';
import {BehaviorSubject, Observable, Subscription} from 'rxjs';
import {PLUGIN_CONTRACT_JOB_DETAIL_MODAL_TEST_IDS} from '../../constants';
import {
  contractJobStatusTagType,
  isContractJobCancellable,
  isContractJobOpen,
  isContractJobRedeliverable,
} from '../../utils';

type ContractJobAction = 'cancel' | 'redeliver';

type PayloadState = 'hidden' | 'loading' | 'shown' | 'error';

interface ContractJobActionConfirmation {
  titleKey: string;
  contentKey: string;
  confirmKey: string;
  confirmButtonType: ModalButtonType;
}

const confirmation = (
  key: string,
  actionKey: string,
  confirmButtonType: ModalButtonType
): ContractJobActionConfirmation => ({
  titleKey: `pluginManagement.contractJobs.${key}.title`,
  contentKey: `pluginManagement.contractJobs.${key}.content`,
  confirmKey: `pluginManagement.contractJobs.actions.${actionKey}`,
  confirmButtonType,
});

const CONFIRMATIONS = {
  cancelJob: confirmation('confirmCancelJob', 'cancelJob', ModalButtonType.danger),
  stopDelivery: confirmation('confirmStopDelivery', 'stopDelivery', ModalButtonType.danger),
  redeliver: confirmation('confirmRedeliver', 'redeliver', ModalButtonType.primary),
} as const;

/**
 * One contract job ledger row. Payloads stay hidden until the admin asks for them, because GZAC
 * records every read of them. Offers cancel while the job is open or its reply is undelivered, and
 * redelivery of a reply given up on.
 */
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
    ConfirmationModalModule,
    LoadingModule,
    ModalModule,
    NotificationModule,
    StructuredListModule,
    TagModule,
    ValtimoCdsModalDirective,
  ],
})
export class PluginContractJobDetailModalComponent implements OnChanges {
  @Input() public open = false;
  @Input() public jobId: string | null = null;

  @Output() public closeEvent = new EventEmitter<void>();
  /** A cancel or redelivery changed the job, or found it changed. */
  @Output() public jobChangedEvent = new EventEmitter<void>();

  public readonly $job = signal<ExternalPluginContractJobDetail | null>(null);
  public readonly $loading = signal(false);
  public readonly $loadErrorKey = signal<string | null>(null);
  public readonly $payloadState = signal<PayloadState>('hidden');
  public readonly $requestPayloadJson = signal('');
  public readonly $resultPayloadJson = signal('');
  public readonly $actionInProgress = signal(false);
  public readonly $actionErrorKey = signal<string | null>(null);

  public readonly $statusTagType = computed(() =>
    contractJobStatusTagType(this.$job()?.status ?? '')
  );
  public readonly $outcomeTagType = computed(() =>
    contractJobStatusTagType(this.$job()?.outcome ?? '')
  );
  public readonly $canCancel = computed(() => {
    const job = this.$job();
    return !!job && isContractJobCancellable(job.status);
  });
  /** Cancelling a finished job stops delivering its reply instead of failing it. */
  public readonly $cancelStopsDelivery = computed(() => {
    const job = this.$job();
    return !!job && !isContractJobOpen(job.status);
  });
  public readonly $canRedeliver = computed(() => {
    const job = this.$job();
    return !!job && isContractJobRedeliverable(job);
  });
  /** Fixed when asked, so the copy does not change while the confirmation closes. */
  public readonly $confirmation = signal<ContractJobActionConfirmation>(CONFIRMATIONS.cancelJob);

  public readonly confirmationOpen$ = new BehaviorSubject<boolean>(false);

  public readonly DATE_FORMAT = 'dd-MM-yyyy HH:mm:ss';

  protected readonly testIds = PLUGIN_CONTRACT_JOB_DETAIL_MODAL_TEST_IDS;

  private _loadSubscription: Subscription | null = null;
  private _payloadSubscription: Subscription | null = null;
  private _pendingAction: ContractJobAction | null = null;

  constructor(private readonly _externalPluginService: ExternalPluginService) {}

  public ngOnChanges(changes: SimpleChanges): void {
    if (!changes['open'] && !changes['jobId']) return;

    if (this.open && this.jobId) {
      this.$actionErrorKey.set(null);
      this._load(this.jobId);
    } else if (!this.open) {
      this._reset();
    }
  }

  public onClose(): void {
    this._reset();
    this.closeEvent.emit();
  }

  public onRetry(): void {
    if (this.jobId) this._load(this.jobId);
  }

  public onShowPayloads(): void {
    const job = this.$job();
    if (!job || this.$payloadState() === 'loading') return;

    this.$payloadState.set('loading');
    this._payloadSubscription?.unsubscribe();
    this._payloadSubscription = this._externalPluginService
      .getContractJobPayload(job.id)
      .subscribe({
        next: payload => this._showPayload(payload),
        error: () => this.$payloadState.set('error'),
      });
  }

  public onCancelJob(): void {
    this._requestConfirmation('cancel');
  }

  public onRedeliver(): void {
    this._requestConfirmation('redeliver');
  }

  public onActionConfirmed(): void {
    const action = this._pendingAction;
    this._pendingAction = null;
    if (action) this._runAction(action);
  }

  public onActionDismissed(): void {
    this._pendingAction = null;
  }

  private _requestConfirmation(action: ContractJobAction): void {
    if (!this.$job() || this.$actionInProgress()) return;

    this._pendingAction = action;
    if (action === 'redeliver') {
      this.$confirmation.set(CONFIRMATIONS.redeliver);
    } else {
      this.$confirmation.set(
        this.$cancelStopsDelivery() ? CONFIRMATIONS.stopDelivery : CONFIRMATIONS.cancelJob
      );
    }
    this.confirmationOpen$.next(true);
  }

  private _runAction(action: ContractJobAction): void {
    const job = this.$job();
    if (!job || this.$actionInProgress()) return;

    this.$actionInProgress.set(true);
    this.$actionErrorKey.set(null);

    const request$: Observable<ExternalPluginContractJobDetail> =
      action === 'cancel'
        ? this._externalPluginService.cancelContractJob(job.id)
        : this._externalPluginService.redeliverContractJob(job.id);

    request$.subscribe({
      next: updated => {
        this.$actionInProgress.set(false);
        this.$job.set(updated);
        this.jobChangedEvent.emit();
      },
      error: (response: HttpErrorResponse) => {
        this.$actionInProgress.set(false);
        if (response?.status !== 409) return;

        // The job moved on since it was loaded; reload its current state
        this.$actionErrorKey.set('pluginManagement.contractJobs.actionRefused');
        this._load(job.id);
        this.jobChangedEvent.emit();
      },
    });
  }

  private _load(jobId: string): void {
    this._loadSubscription?.unsubscribe();
    this._resetPayloads();
    this.$job.set(null);
    this.$loadErrorKey.set(null);
    this.$loading.set(true);
    this._loadSubscription = this._externalPluginService.getContractJob(jobId).subscribe({
      next: job => {
        this.$job.set(job);
        this.$loading.set(false);
      },
      error: (response: HttpErrorResponse) => {
        this.$loading.set(false);
        this.$loadErrorKey.set(
          response?.status === 404
            ? 'pluginManagement.contractJobs.notFound'
            : 'pluginManagement.contractJobs.loadFailed'
        );
      },
    });
  }

  private _showPayload(payload: ExternalPluginContractJobPayload): void {
    this.$requestPayloadJson.set(this._formatPayload(payload?.requestPayload));
    this.$resultPayloadJson.set(this._formatPayload(payload?.resultPayload));
    this.$payloadState.set('shown');
  }

  private _formatPayload(value: unknown): string {
    if (value === null || value === undefined) return '';
    if (typeof value !== 'string') return JSON.stringify(value, null, 2);

    try {
      return JSON.stringify(JSON.parse(value), null, 2);
    } catch {
      return value;
    }
  }

  private _resetPayloads(): void {
    this._payloadSubscription?.unsubscribe();
    this._payloadSubscription = null;
    this.$payloadState.set('hidden');
    this.$requestPayloadJson.set('');
    this.$resultPayloadJson.set('');
  }

  private _reset(): void {
    this._loadSubscription?.unsubscribe();
    this._resetPayloads();
    this._pendingAction = null;
    this.$actionErrorKey.set(null);
    this.$loadErrorKey.set(null);
  }
}
