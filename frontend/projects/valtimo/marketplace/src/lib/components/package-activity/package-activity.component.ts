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
import {ChangeDetectionStrategy, Component, OnInit} from '@angular/core';
import {TranslateModule, TranslateService} from '@ngx-translate/core';
import {CarbonListModule, ColumnConfig, ViewType} from '@valtimo/components';
import {map, Observable} from 'rxjs';
import {PackageJobRow} from '../../models';
import {MarketplacePageService} from '../../services/marketplace-page.service';

/**
 * The audit trail: every install, update, removal and upload with who did it and how it
 * ended. Read-only by design — this is the compliance record, not a control surface.
 */
@Component({
  standalone: true,
  templateUrl: './package-activity.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'valtimo-package-activity',
  imports: [CommonModule, TranslateModule, CarbonListModule],
})
export class PackageActivityComponent implements OnInit {
  public readonly loading$ = this.marketplacePageService.jobsLoading$;

  public readonly items$: Observable<PackageJobRow[]> = this.marketplacePageService.jobs$.pipe(
    map(jobs =>
      jobs.map(job => ({
        ...job,
        packageLabel: job.packageName || job.packageId,
        operationLabel: this.translateService.instant(
          `packageManagement.operationLabel.${job.operation}`
        ),
        statusLabel: this.translateService.instant(`packageManagement.status.${job.status}`),
        // Rendered as one cell rather than two columns: for an uninstall or an upload one
        // side is always empty, and two half-filled columns read worse than an arrow.
        versionChange: job.fromVersion
          ? `${job.fromVersion} → ${job.toVersion ?? '—'}`
          : (job.toVersion ?? '—'),
      }))
    )
  );

  public readonly fields: ColumnConfig[] = [
    {key: 'createdOn', label: 'packageManagement.columns.when', viewType: ViewType.DATE_TIME},
    {key: 'packageLabel', label: 'packageManagement.columns.name', viewType: ViewType.TEXT},
    {key: 'operationLabel', label: 'packageManagement.columns.operation', viewType: ViewType.TEXT},
    {key: 'versionChange', label: 'packageManagement.columns.version', viewType: ViewType.TEXT},
    {key: 'statusLabel', label: 'packageManagement.columns.outcome', viewType: ViewType.TEXT},
    {key: 'createdBy', label: 'packageManagement.columns.by', viewType: ViewType.TEXT},
    {key: 'errorMessage', label: 'packageManagement.columns.error', viewType: ViewType.TEXT},
  ];

  constructor(
    private readonly marketplacePageService: MarketplacePageService,
    private readonly translateService: TranslateService
  ) {}

  public ngOnInit(): void {
    this.marketplacePageService.loadJobs();
  }
}
