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
import {TranslateModule, TranslateService} from '@ngx-translate/core';
import {ActionItem, CarbonListModule, ColumnConfig, ViewType} from '@valtimo/components';
import {map, Observable} from 'rxjs';
import {PackageListItem, PackageRow} from '../../models';
import {MarketplacePageService} from '../../services/marketplace-page.service';
import {PackageOperationService} from '../../services/package-operation.service';

@Component({
  standalone: true,
  templateUrl: './package-installed.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'valtimo-package-installed',
  imports: [CommonModule, TranslateModule, CarbonListModule],
})
export class PackageInstalledComponent {
  public readonly loading$ = this.marketplacePageService.loading$;

  public readonly items$: Observable<PackageRow[]> =
    this.marketplacePageService.installedPackages$.pipe(
      map(packages =>
        packages.map(pkg => ({
          ...pkg,
          name: pkg.name || pkg.id,
          typeLabel: this.translateService.instant(
            `packageManagement.type.${pkg.type ?? 'plugin'}`
          ),
          // Shown instead of an empty cell when the package is already current.
          availableVersion:
            pkg.nextVersion ?? this.translateService.instant('packageManagement.upToDate'),
        }))
      )
    );

  public readonly fields: ColumnConfig[] = [
    {key: 'name', label: 'packageManagement.columns.name', viewType: ViewType.TEXT},
    {key: 'typeLabel', label: 'packageManagement.columns.type', viewType: ViewType.TEXT},
    {key: 'provider', label: 'packageManagement.columns.provider', viewType: ViewType.TEXT},
    {
      key: 'installedVersion',
      label: 'packageManagement.columns.installedVersion',
      viewType: ViewType.TEXT,
    },
    {
      key: 'availableVersion',
      label: 'packageManagement.columns.availableVersion',
      viewType: ViewType.TEXT,
    },
  ];

  public readonly actionItems$: Observable<ActionItem[]> = this.translateService
    .stream('packageManagement.update')
    .pipe(
      map(() => [
        {
          label: this.translateService.instant('packageManagement.update'),
          callback: (pkg: PackageListItem) => this.packageOperationService.startUpdate(pkg),
          disabledCallback: (pkg: PackageListItem) => !pkg.capabilities?.updatable,
        },
        {
          label: this.translateService.instant('packageManagement.uninstall'),
          callback: (pkg: PackageListItem) => this.packageOperationService.startUninstall(pkg),
          disabledCallback: (pkg: PackageListItem) => !pkg.capabilities?.uninstallable,
          type: 'danger' as const,
        },
      ])
    );

  constructor(
    private readonly marketplacePageService: MarketplacePageService,
    private readonly packageOperationService: PackageOperationService,
    private readonly translateService: TranslateService
  ) {}
}
