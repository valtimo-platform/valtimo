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
import {ChangeDetectionStrategy, Component, OnDestroy, OnInit} from '@angular/core';
import {FormControl, ReactiveFormsModule} from '@angular/forms';
import {TranslateModule, TranslateService} from '@ngx-translate/core';
import {
  ButtonModule,
  CheckboxModule,
  IconModule,
  IconService,
  LoadingModule,
  PaginationModel,
  PaginationModule,
  SearchModule,
} from 'carbon-components-angular';
import {Grid16, List16, Search16} from '@carbon/icons';
import {Router} from '@angular/router';
import {ActionItem, CarbonListModule, ColumnConfig, ViewType} from '@valtimo/components';
import {combineLatest, debounceTime, map, Observable, Subscription} from 'rxjs';
import {MARKETPLACE_TEST_IDS} from '../../constants';
import {PackageListItem, PackageRow, PackageSort, PackageType, PackageViewType} from '../../models';
import {MarketplacePageService} from '../../services/marketplace-page.service';
import {PackageOperationService} from '../../services/package-operation.service';
import {PackageCardComponent} from '../package-card/package-card.component';

@Component({
  standalone: true,
  templateUrl: './package-discover.component.html',
  styleUrls: ['./package-discover.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'valtimo-package-discover',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TranslateModule,
    ButtonModule,
    CheckboxModule,
    IconModule,
    LoadingModule,
    PaginationModule,
    SearchModule,
    CarbonListModule,
    PackageCardComponent,
  ],
})
export class PackageDiscoverComponent implements OnInit, OnDestroy {
  public readonly searchControl = new FormControl<string>('');

  public readonly PackageViewType = PackageViewType;
  public readonly SORT_OPTIONS = [
    PackageSort.NAME_ASC,
    PackageSort.NAME_DESC,
    PackageSort.UPDATED_DESC,
  ];
  public readonly TYPE_OPTIONS = [PackageType.PLUGIN, PackageType.CASE, PackageType.BUILDING_BLOCK];

  public readonly filters$ = this.marketplacePageService.filters$;
  public readonly loading$ = this.marketplacePageService.loading$;
  public readonly pagedPackages$ = this.marketplacePageService.pagedPackages$;
  public readonly pending$ = this.marketplacePageService.pending$;
  public readonly typeCounts$ = this.marketplacePageService.typeCounts$;
  public readonly viewType$ = this.marketplacePageService.viewType$;

  public readonly paginationModel$: Observable<PaginationModel> = combineLatest([
    this.marketplacePageService.filteredCount$,
    this.marketplacePageService.page$,
    this.marketplacePageService.pageSize$,
  ]).pipe(
    map(([totalDataLength, currentPage, pageLength]) => ({
      currentPage,
      pageLength,
      totalDataLength,
    }))
  );

  /**
   * Row actions for the table view. Built from a translation stream so the labels follow
   * a runtime language switch; the callbacks are driven by the backend-reported
   * capabilities, so a config package never offers "uninstall".
   */
  public readonly tableActionItems$: Observable<ActionItem[]> = this.translateService
    .stream('packageManagement.install')
    .pipe(
      map(() => [
        {
          label: this.translateService.instant('packageManagement.install'),
          callback: (pkg: PackageListItem) => this.onInstall(pkg),
          disabledCallback: (pkg: PackageListItem) => !pkg.capabilities?.installable,
        },
        {
          label: this.translateService.instant('packageManagement.update'),
          callback: (pkg: PackageListItem) => this.onUpdate(pkg),
          disabledCallback: (pkg: PackageListItem) => !pkg.capabilities?.updatable,
        },
        {
          label: this.translateService.instant('packageManagement.uninstall'),
          callback: (pkg: PackageListItem) => this.onUninstall(pkg),
          disabledCallback: (pkg: PackageListItem) => !pkg.capabilities?.uninstallable,
          type: 'danger' as const,
        },
      ])
    );

  /**
   * The current page mapped to table rows. Derived here rather than by calling a method
   * from the template: a method binding re-runs on every change-detection pass and would
   * hand `carbon-list` a fresh array each time.
   */
  public readonly tableRows$: Observable<PackageRow[]> = this.pagedPackages$.pipe(
    map(packages =>
      packages.map(pkg => ({
        ...pkg,
        name: pkg.name || pkg.id,
        typeLabel: this.translateService.instant(`packageManagement.type.${pkg.type ?? 'plugin'}`),
      }))
    )
  );

  public readonly tableFields: ColumnConfig[] = [
    {key: 'name', label: 'packageManagement.columns.name', viewType: ViewType.TEXT},
    {key: 'typeLabel', label: 'packageManagement.columns.type', viewType: ViewType.TEXT},
    {key: 'provider', label: 'packageManagement.columns.provider', viewType: ViewType.TEXT},
    {
      key: 'installedVersion',
      label: 'packageManagement.columns.installedVersion',
      viewType: ViewType.TEXT,
    },
    {
      key: 'latestVersion',
      label: 'packageManagement.columns.latestVersion',
      viewType: ViewType.TEXT,
    },
  ];

  protected readonly testIds = MARKETPLACE_TEST_IDS;

  private readonly _subscriptions = new Subscription();

  constructor(
    private readonly marketplacePageService: MarketplacePageService,
    private readonly packageOperationService: PackageOperationService,
    private readonly translateService: TranslateService,
    private readonly router: Router,
    private readonly iconService: IconService
  ) {
    this.iconService.registerAll([Grid16, List16, Search16]);
  }

  public ngOnInit(): void {
    // Debounced so typing does not re-filter (and re-render the grid) per keystroke.
    this._subscriptions.add(
      this.searchControl.valueChanges
        .pipe(debounceTime(300))
        .subscribe(search => this.marketplacePageService.setSearch(search ?? ''))
    );
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  public onClearFilters(): void {
    this.searchControl.setValue('', {emitEvent: false});
    this.marketplacePageService.clearFilters();
  }

  public onInstall(pkg: PackageListItem): void {
    this.packageOperationService.startInstall(pkg);
  }

  public onOpenDetail(pkg: PackageListItem): void {
    this.router.navigate(['/marketplace', pkg.id]);
  }

  public onSelectPage(page: number): void {
    this.marketplacePageService.setPage(page);
  }

  public onSortChange(sort: string): void {
    this.marketplacePageService.setSort(sort as PackageSort);
  }

  public onToggleType(type: string): void {
    this.marketplacePageService.toggleType(type);
  }

  public onUninstall(pkg: PackageListItem): void {
    this.packageOperationService.startUninstall(pkg);
  }

  public onUpdate(pkg: PackageListItem): void {
    this.packageOperationService.startUpdate(pkg);
  }

  public onViewTypeChange(viewType: PackageViewType): void {
    this.marketplacePageService.setViewType(viewType);
  }

  public trackByPackage(_index: number, pkg: PackageListItem): string {
    return pkg.id;
  }
}
