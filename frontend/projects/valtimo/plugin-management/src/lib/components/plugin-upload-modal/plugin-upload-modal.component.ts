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
  DestroyRef,
  EventEmitter,
  inject,
  Input,
  OnChanges,
  Output,
  signal,
  SimpleChanges,
} from '@angular/core';
import {CommonModule} from '@angular/common';
import {HttpErrorResponse} from '@angular/common/http';
import {TranslateModule, TranslateService} from '@ngx-translate/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {FormBuilder, ReactiveFormsModule, Validators} from '@angular/forms';
import {
  ButtonModule,
  DropdownModule,
  FileUploaderModule,
  LayerModule,
  ListItem,
  LoadingModule,
  ModalModule,
  NotificationContent,
  NotificationModule,
} from 'carbon-components-angular';
import {ConfirmationModalModule, ValtimoCdsModalDirective} from '@valtimo/components';
import {
  ExternalPluginEndpoint,
  ExternalPluginHost,
  ExternalPluginService,
  ExternalPluginUploadResult,
} from '@valtimo/plugin';
import {BehaviorSubject} from 'rxjs';
import {buildExternalPluginCompatibilityMessage} from '../../utils';
import {PluginExternalPermissionsComponent} from '../plugin-external-permissions/plugin-external-permissions.component';

/**
 * State of the overwrite-review dialog: what the already-existing version is, the permissions the
 * uploaded package requests (shown for re-review) and the pre-built warning notification.
 */
interface OverwriteReview {
  pluginId: string;
  version: string;
  endpoints: Array<ExternalPluginEndpoint>;
  eventSubscriptions: Array<string>;
  capabilities: Array<string>;
  egress: Array<string>;
  warning: NotificationContent;
}

/**
 * Mirrors `ExternalPluginManagementResource.MAX_PLUGIN_UPLOAD_BYTES`, so an oversized package is
 * refused on selection rather than after transferring it. The backend stays the authority: its 413
 * is handled too, and its `maxBytes` wins when the two disagree.
 */
const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;

@Component({
  standalone: true,
  selector: 'valtimo-plugin-upload-modal',
  templateUrl: './plugin-upload-modal.component.html',
  styleUrls: ['./plugin-upload-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    TranslateModule,
    ReactiveFormsModule,
    ModalModule,
    ButtonModule,
    DropdownModule,
    FileUploaderModule,
    LayerModule,
    LoadingModule,
    NotificationModule,
    ValtimoCdsModalDirective,
    ConfirmationModalModule,
    PluginExternalPermissionsComponent,
  ],
})
export class PluginUploadModalComponent implements OnChanges {
  @Input() public open = false;
  @Input() public hosts: Array<ExternalPluginHost> = [];

  @Output() public closeEvent = new EventEmitter<void>();
  /**
   * Emitted only on a successful upload, carrying the host's `{pluginId, version}` so the parent
   * can name the installed plugin in its success notification.
   */
  @Output() public uploadedEvent = new EventEmitter<ExternalPluginUploadResult>();

  public readonly $uploading = signal(false);
  public readonly $hostItems = signal<Array<ListItem>>([]);
  public readonly $selectedHostId = signal<string | null>(null);

  // Drives the "upload anyway?" confirmation shown when the backend rejects an incompatible plugin.
  public readonly _compatibilityModalOpen$ = new BehaviorSubject<boolean>(false);
  public readonly $compatibilityWarning = signal<string>('');

  // Inline notification for outcomes the modal handles itself: an identical package that is
  // already on the host (info) or any other host rejection (error). These 409s are deliberately
  // kept off the global error toast (X-Skip-Interceptor), so this notification is their only
  // surface.
  public readonly $uploadNotification = signal<NotificationContent | null>(null);

  // Drives the overwrite-review dialog shown when the uploaded pluginId@version already exists
  // with different content: the admin re-reviews the requested permissions and explicitly
  // confirms before the version is overwritten.
  public readonly $overwriteReview = signal<OverwriteReview | null>(null);
  public readonly $overwriteAcknowledged = signal<boolean>(false);

  public readonly _fileForm = this._formBuilder.group({
    file: this._formBuilder.control(new Set<any>(), [Validators.required]),
  });

  public readonly $fileSelected = signal(false);
  public readonly $fileTooLarge = signal(false);

  private readonly _destroyRef = inject(DestroyRef);

  constructor(
    private readonly _formBuilder: FormBuilder,
    private readonly _externalPluginService: ExternalPluginService,
    private readonly _translateService: TranslateService
  ) {
    this._fileForm
      .get('file')!
      .valueChanges.pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe(value => {
        this.$fileSelected.set(value instanceof Set && value.size > 0);
        const file = this._selectedFile(value);
        const tooLarge = !!file && file.size > MAX_UPLOAD_BYTES;
        this.$fileTooLarge.set(tooLarge);
        this.$uploadNotification.set(
          tooLarge ? this._buildTooLargeNotification(file!.size, MAX_UPLOAD_BYTES) : null
        );
      });
  }

  public ngOnChanges(changes: SimpleChanges): void {
    if (changes['hosts']) {
      const selectedHostId = this.$selectedHostId();
      this.$hostItems.set(
        (this.hosts ?? []).map(host => ({
          content: `${host.name} (${host.baseUrl})`,
          selected: host.id === selectedHostId,
          hostId: host.id,
        }))
      );
    }
  }

  public onHostSelected(event: {item: ListItem & {hostId?: string}}): void {
    this.$selectedHostId.set(event?.item?.hostId ?? null);
  }

  public onUpload(force = false, overwrite = false): void {
    const hostId = this.$selectedHostId();
    const file = this._selectedFile(this._fileForm.value.file);

    if (!hostId || !file || this.$fileTooLarge()) return;

    this.$uploading.set(true);
    this.$uploadNotification.set(null);

    this._externalPluginService.uploadPlugin(hostId, file, force, overwrite).subscribe({
      next: (result: ExternalPluginUploadResult) => {
        this.$uploading.set(false);
        this.uploadedEvent.emit(result);
        this._resetAndClose();
      },
      error: (error: HttpErrorResponse) => {
        this.$uploading.set(false);
        if (error.status === 409 && error.error?.incompatible) {
          this.$compatibilityWarning.set(
            buildExternalPluginCompatibilityMessage(error.error, this._translateService)
          );
          this._compatibilityModalOpen$.next(true);
        } else if (error.status === 409 && error.error?.code === 'PLUGIN_VERSION_EXISTS') {
          this._handleVersionExists(error.error);
        } else if (error.status === 409) {
          this.$uploadNotification.set(this._buildUploadErrorNotification(error));
        } else if (error.status === 413) {
          this.$uploadNotification.set(
            this._buildTooLargeNotification(file.size, error.error?.maxBytes ?? MAX_UPLOAD_BYTES)
          );
        }
      },
    });
  }

  public onConfirmOverwrite(): void {
    this.$overwriteReview.set(null);
    // Compatibility was already checked (or explicitly forced) on the attempt that produced the
    // version-exists 409; force=true keeps the compatibility gate from prompting a second time.
    this.onUpload(true, true);
  }

  public onCancelOverwrite(): void {
    this.$overwriteReview.set(null);
  }

  public onOverwriteValidityChange(valid: boolean): void {
    this.$overwriteAcknowledged.set(valid);
  }

  public onConfirmIncompatibleUpload(): void {
    this._compatibilityModalOpen$.next(false);
    this.onUpload(true);
  }

  public onCancelIncompatibleUpload(): void {
    this._compatibilityModalOpen$.next(false);
  }

  public onClose(): void {
    if (this.$uploading()) return;
    this._resetAndClose();
  }

  private _resetAndClose(): void {
    this.closeEvent.emit();
    this.$selectedHostId.set(null);
    this.$fileSelected.set(false);
    this.$fileTooLarge.set(false);
    this.$uploadNotification.set(null);
    this.$overwriteReview.set(null);
    this.$overwriteAcknowledged.set(false);
    this._fileForm.reset({file: new Set()});
  }

  /**
   * The uploaded pluginId@version already exists on the host. Identical content means there is
   * nothing to overwrite — a friendly info suffices. Different (or undeterminable) content opens
   * the overwrite-review dialog: the requested permissions from the enriched 409 body are shown
   * for re-review and the admin must explicitly acknowledge them before the overwrite proceeds.
   */
  private _handleVersionExists(body: {
    pluginId?: string;
    version?: string;
    currentContentHash?: string;
    uploadedContentHash?: string;
    requestedEndpoints?: Array<ExternalPluginEndpoint>;
    requestedEventSubscriptions?: Array<string>;
    requestedCapabilities?: Array<string>;
    requestedEgress?: Array<string>;
  }): void {
    const identical =
      !!body.currentContentHash &&
      !!body.uploadedContentHash &&
      body.currentContentHash === body.uploadedContentHash;

    if (identical) {
      this.$uploadNotification.set({
        type: 'info',
        title: this._translateService.instant('pluginManagement.upload.identicalTitle'),
        message: this._translateService.instant('pluginManagement.upload.identicalMessage'),
        showClose: false,
        lowContrast: true,
      });
      return;
    }

    this.$overwriteAcknowledged.set(false);
    this.$overwriteReview.set({
      pluginId: body.pluginId ?? '',
      version: body.version ?? '',
      endpoints: body.requestedEndpoints ?? [],
      eventSubscriptions: body.requestedEventSubscriptions ?? [],
      capabilities: body.requestedCapabilities ?? [],
      egress: body.requestedEgress ?? [],
      warning: {
        type: 'warning',
        title: this._translateService.instant('pluginManagement.upload.overwriteWarningTitle'),
        message: this._translateService.instant('pluginManagement.upload.overwriteWarning', {
          pluginId: body.pluginId ?? '',
          version: body.version ?? '',
        }),
        showClose: false,
        lowContrast: true,
      },
    });
  }

  private _selectedFile(value: Set<any> | null | undefined): File | undefined {
    return value?.values()?.next()?.value?.file;
  }

  private _buildTooLargeNotification(sizeBytes: number, maxBytes: number): NotificationContent {
    // The size rounds UP and the limit rounds DOWN, so a package only just over the cap can never
    // render as "is 100.0 MB, maximum is 100.0 MB" — which reads as though nothing were wrong.
    const MB = 1024 * 1024;
    const toMb = (bytes: number, round: (n: number) => number): string =>
      (round((bytes / MB) * 10) / 10).toFixed(1);
    return {
      type: 'error',
      title: this._translateService.instant('pluginManagement.upload.tooLargeTitle'),
      message: this._translateService.instant('pluginManagement.upload.tooLarge', {
        sizeMb: toMb(sizeBytes, Math.ceil),
        maxMb: toMb(maxBytes, Math.floor),
      }),
      showClose: false,
      lowContrast: true,
    };
  }

  private _buildUploadErrorNotification(error: HttpErrorResponse): NotificationContent {
    const hostBody = this._parseRelayedHostBody(error);
    const message = [
      this._translateService.instant('pluginManagement.upload.rejected'),
      hostBody?.message ?? hostBody?.error ?? '',
    ]
      .filter(Boolean)
      .join(' ');

    return {
      type: 'error',
      title: this._translateService.instant('pluginManagement.upload.failedTitle'),
      message,
      showClose: false,
      lowContrast: true,
    };
  }

  // The backend relays a host rejection as `{error, detail}` where `detail` holds the host's raw
  // JSON body (e.g. `{code, error, message}`); non-JSON detail is shown as-is.
  private _parseRelayedHostBody(
    error: HttpErrorResponse
  ): {code?: string; error?: string; message?: string} | null {
    const detail = error.error?.detail;
    if (typeof detail !== 'string' || detail.length === 0) return null;

    try {
      return JSON.parse(detail);
    } catch {
      return {message: detail};
    }
  }
}
