/*
 * Copyright 2015-2024 Ritense BV, the Netherlands.
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
import {ChangeDetectionStrategy, Component} from '@angular/core';
import {TranslateModule} from '@ngx-translate/core';
import {ButtonModule, LoadingModule, ModalModule, TagModule} from 'carbon-components-angular';
import {MARKETPLACE_TEST_IDS} from '../../constants';
import {
  InstallFlowStep,
  PackageJobStatus,
  PackageOperation,
  PackagePreflight,
  PackageTrust,
} from '../../models';
import {PackageOperationService} from '../../services/package-operation.service';

@Component({
  standalone: true,
  templateUrl: './package-operation-modal.component.html',
  styleUrls: ['./package-operation-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'valtimo-package-operation-modal',
  imports: [CommonModule, TranslateModule, ButtonModule, LoadingModule, ModalModule, TagModule],
})
export class PackageOperationModalComponent {
  public readonly InstallFlowStep = InstallFlowStep;
  public readonly PackageJobStatus = PackageJobStatus;
  public readonly PackageOperation = PackageOperation;
  public readonly PackageTrust = PackageTrust;

  public readonly job$ = this.packageOperationService.job$;
  public readonly operation$ = this.packageOperationService.operation$;
  public readonly package$ = this.packageOperationService.package$;
  public readonly preflight$ = this.packageOperationService.preflight$;
  public readonly preflightError$ = this.packageOperationService.preflightError$;
  public readonly preflightLoading$ = this.packageOperationService.preflightLoading$;
  public readonly step$ = this.packageOperationService.step$;
  public readonly visible$ = this.packageOperationService.visible$;

  protected readonly testIds = MARKETPLACE_TEST_IDS;

  constructor(private readonly packageOperationService: PackageOperationService) {}

  public onClose(): void {
    this.packageOperationService.close();
  }

  public onConfirm(): void {
    this.packageOperationService.confirm();
  }

  /**
   * Whether the operation may be started. An uninstall needs no verdict; anything else
   * needs a preflight that came back without blockers — a missing verdict is treated as
   * "not allowed", since proceeding blind is what the review step exists to prevent.
   */
  public canConfirm(
    operation: PackageOperation | null,
    preflight: PackagePreflight | null
  ): boolean {
    if (operation === PackageOperation.UNINSTALL) return true;
    return !!preflight && preflight.blockers.length === 0;
  }

  /** Human-readable download size; the backend reports bytes or nothing at all. */
  public formatSize(bytes?: number): string | null {
    if (!bytes || bytes <= 0) return null;
    const megabytes = bytes / (1024 * 1024);
    return megabytes >= 1
      ? `${megabytes.toFixed(1)} MB`
      : `${Math.max(1, Math.round(bytes / 1024))} kB`;
  }
}
