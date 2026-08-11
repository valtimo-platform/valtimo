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

import {Injectable, OnDestroy} from '@angular/core';
import {GlobalNotificationService} from '@valtimo/shared';
import {TranslateService} from '@ngx-translate/core';
import {NGXLogger} from 'ngx-logger';
import {BehaviorSubject, combineLatest, map, Observable, Subscription} from 'rxjs';
import {
  MarketplaceTab,
  PackageCatalogue,
  PackageFilters,
  PackageJob,
  PackageJobStatus,
  PackageListItem,
  PackageSort,
  PackageStore,
  PackageViewType,
} from '../models';
import {PackageService} from './package.service';

const DEFAULT_FILTERS: PackageFilters = {
  search: '',
  types: [],
  sort: PackageSort.NAME_ASC,
};

const DEFAULT_PAGE_SIZE = 12;
const ACTIVITY_PAGE_SIZE = 50;

/**
 * Page-scoped state for the marketplace: the catalogue, the Discover filters, and the
 * install/update/uninstall actions. Provided by PackageManagementComponent so the tab
 * components share one catalogue read instead of each fetching its own.
 */
@Injectable()
export class MarketplacePageService implements OnDestroy {
  private readonly _catalogue$ = new BehaviorSubject<PackageCatalogue | null>(null);
  private readonly _loading$ = new BehaviorSubject<boolean>(true);
  private readonly _refreshing$ = new BehaviorSubject<boolean>(false);
  private readonly _filters$ = new BehaviorSubject<PackageFilters>(DEFAULT_FILTERS);
  private readonly _viewType$ = new BehaviorSubject<PackageViewType>(PackageViewType.GRID);
  private readonly _activeTab$ = new BehaviorSubject<MarketplaceTab>(MarketplaceTab.DISCOVER);
  private readonly _page$ = new BehaviorSubject<number>(1);
  private readonly _pageSize$ = new BehaviorSubject<number>(DEFAULT_PAGE_SIZE);

  /**
   * Ids of packages with an action in flight, so the UI can disable exactly those rows.
   * A Set rather than a single id: batch actions from the Updates tab run concurrently.
   */
  private readonly _pending$ = new BehaviorSubject<Set<string>>(new Set());

  private readonly _jobs$ = new BehaviorSubject<PackageJob[]>([]);
  private readonly _jobsLoading$ = new BehaviorSubject<boolean>(false);
  private readonly _stores$ = new BehaviorSubject<PackageStore[]>([]);
  private readonly _storesLoading$ = new BehaviorSubject<boolean>(false);
  private readonly _uploading$ = new BehaviorSubject<boolean>(false);

  private readonly _subscriptions = new Subscription();

  public readonly jobs$: Observable<PackageJob[]> = this._jobs$.asObservable();
  public readonly jobsLoading$: Observable<boolean> = this._jobsLoading$.asObservable();
  public readonly stores$: Observable<PackageStore[]> = this._stores$.asObservable();
  public readonly storesLoading$: Observable<boolean> = this._storesLoading$.asObservable();
  public readonly uploading$: Observable<boolean> = this._uploading$.asObservable();

  public readonly loading$: Observable<boolean> = this._loading$.asObservable();
  public readonly refreshing$: Observable<boolean> = this._refreshing$.asObservable();
  public readonly filters$: Observable<PackageFilters> = this._filters$.asObservable();
  public readonly viewType$: Observable<PackageViewType> = this._viewType$.asObservable();
  public readonly activeTab$: Observable<MarketplaceTab> = this._activeTab$.asObservable();
  public readonly pending$: Observable<Set<string>> = this._pending$.asObservable();
  public readonly page$: Observable<number> = this._page$.asObservable();
  public readonly pageSize$: Observable<number> = this._pageSize$.asObservable();

  public readonly lastRefreshed$: Observable<string | undefined> = this._catalogue$.pipe(
    map(catalogue => catalogue?.lastRefreshed)
  );

  public readonly systemVersion$: Observable<string | undefined> = this._catalogue$.pipe(
    map(catalogue => catalogue?.systemVersion)
  );

  private readonly _packages$: Observable<PackageListItem[]> = this._catalogue$.pipe(
    map(catalogue => catalogue?.packages ?? [])
  );

  /** Every package matching the current Discover filters, sorted. Not yet paginated. */
  public readonly filteredPackages$: Observable<PackageListItem[]> = combineLatest([
    this._packages$,
    this._filters$,
  ]).pipe(map(([packages, filters]) => this.sort(this.filter(packages, filters), filters.sort)));

  /** The current Discover page. */
  public readonly pagedPackages$: Observable<PackageListItem[]> = combineLatest([
    this.filteredPackages$,
    this._page$,
    this._pageSize$,
  ]).pipe(
    map(([packages, page, pageSize]) => packages.slice((page - 1) * pageSize, page * pageSize))
  );

  public readonly filteredCount$: Observable<number> = this.filteredPackages$.pipe(
    map(packages => packages.length)
  );

  public readonly installedPackages$: Observable<PackageListItem[]> = this._packages$.pipe(
    map(packages => packages.filter(pkg => !!pkg.installedVersion))
  );

  /** Installed packages with a compatible newer version available. */
  public readonly updatablePackages$: Observable<PackageListItem[]> = this._packages$.pipe(
    map(packages => packages.filter(pkg => !!pkg.installedVersion && !!pkg.nextVersion))
  );

  public readonly updatesAvailable$: Observable<number> = this._catalogue$.pipe(
    map(catalogue => catalogue?.updatesAvailable ?? 0)
  );

  /** Type counts over the UNFILTERED catalogue, so filter labels don't move as you filter. */
  public readonly typeCounts$: Observable<Record<string, number>> = this._packages$.pipe(
    map(packages =>
      packages.reduce((counts: Record<string, number>, pkg: PackageListItem) => {
        const type = pkg.type ?? 'plugin';
        return {...counts, [type]: (counts[type] ?? 0) + 1};
      }, {})
    )
  );

  constructor(
    private readonly packageService: PackageService,
    private readonly globalNotificationService: GlobalNotificationService,
    private readonly translateService: TranslateService,
    private readonly logger: NGXLogger
  ) {}

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  public loadCatalogue(): void {
    this._loading$.next(true);
    this.packageService.getCatalogue().subscribe({
      next: catalogue => {
        this._catalogue$.next(catalogue);
        this._loading$.next(false);
      },
      error: () => this._loading$.next(false),
    });
  }

  /** Ask the backend to re-read its package repositories, then show the fresh result. */
  public refreshCatalogue(): void {
    this._refreshing$.next(true);
    this.packageService.refreshCatalogue().subscribe({
      next: catalogue => {
        this._catalogue$.next(catalogue);
        this._refreshing$.next(false);
      },
      error: () => this._refreshing$.next(false),
    });
  }

  public setActiveTab(tab: MarketplaceTab): void {
    this._activeTab$.next(tab);
  }

  public setViewType(viewType: PackageViewType): void {
    this._viewType$.next(viewType);
  }

  public setSearch(search: string): void {
    this.patchFilters({search});
  }

  public setSort(sort: PackageSort): void {
    this.patchFilters({sort});
  }

  public toggleType(type: string): void {
    const types = this._filters$.getValue().types;
    this.patchFilters({
      types: types.includes(type) ? types.filter(t => t !== type) : [...types, type],
    });
  }

  public clearFilters(): void {
    this._filters$.next(DEFAULT_FILTERS);
    this._page$.next(1);
  }

  public setPage(page: number): void {
    this._page$.next(page);
  }

  public setPageSize(pageSize: number): void {
    this._pageSize$.next(pageSize);
    this._page$.next(1);
  }

  /**
   * Update every package that has one pending, without a review step per package.
   *
   * Deliberately different from a single update: the user has just read the whole list on
   * the Updates tab, and a modal per package would be worse. Each submission is a job;
   * the rows stay disabled until their job reports a terminal state.
   */
  public updateAll(packages: PackageListItem[]): void {
    packages.forEach(pkg => {
      if (!pkg.nextVersion) return;
      this.setPending(pkg.id, true);
      this.packageService.updatePackage(pkg.id, pkg.nextVersion).subscribe({
        next: job => this.followBatchJob(pkg, job.id),
        error: error =>
          this.onBatchError(pkg, 'packageManagement.notification.updateFailed', error),
      });
    });
  }

  public packageName(pkg: PackageListItem): string {
    return pkg.name || pkg.id;
  }

  /** Load the activity trail. Read on demand, since it is its own tab. */
  public loadJobs(): void {
    this._jobsLoading$.next(true);
    this.packageService.getJobs(0, ACTIVITY_PAGE_SIZE).subscribe({
      next: page => {
        this._jobs$.next(page.content);
        this._jobsLoading$.next(false);
      },
      error: () => this._jobsLoading$.next(false),
    });
  }

  public loadStores(): void {
    this._storesLoading$.next(true);
    this.packageService.getStores().subscribe({
      next: stores => {
        this._stores$.next(stores);
        this._storesLoading$.next(false);
      },
      error: () => this._storesLoading$.next(false),
    });
  }

  /** Install a package from a file, for environments that cannot reach a store. */
  public uploadPackage(file: File): void {
    this._uploading$.next(true);
    this.packageService.uploadPackage(file).subscribe({
      next: job => {
        this._uploading$.next(false);
        const failed = job.status === PackageJobStatus.FAILED;
        this.globalNotificationService.showToast({
          title: this.translateService.instant(
            failed
              ? 'packageManagement.notification.uploadFailed'
              : 'packageManagement.notification.uploaded',
            {name: job.packageName ?? job.packageId}
          ),
          type: failed ? 'error' : 'success',
        });
        if (!failed) {
          this.loadPackageFrontend(job.packageId, job.packageName ?? job.packageId);
        }
        this.loadCatalogue();
        this.loadJobs();
      },
      error: () => this._uploading$.next(false),
    });
  }

  /**
   * Pull in the package's frontend bundle so its contributions appear without a reload.
   *
   * A failure here is NOT a failed install: the backend part is installed and running.
   * (This used to uninstall the package again, which threw away a working backend
   * install because a browser-side module failed to load.) The user is told a reload is
   * needed instead.
   */
  public loadPackageFrontend(packageId: string, packageName: string): void {
    this.packageService.load(packageId).subscribe({
      error: error => {
        this.logger.error(`Failed to load frontend of package '${packageId}'.`, error);
        this.globalNotificationService.showToast({
          title: this.translateService.instant(
            'packageManagement.notification.frontendLoadFailed',
            {name: packageName}
          ),
          type: 'warning',
        });
      },
    });
  }

  private followBatchJob(pkg: PackageListItem, jobId: string): void {
    this._subscriptions.add(
      this.packageService.pollJob(jobId).subscribe({
        next: job => {
          if (job.status !== PackageJobStatus.SUCCEEDED && job.status !== PackageJobStatus.FAILED) {
            return;
          }
          this.setPending(pkg.id, false);
          const failed = job.status === PackageJobStatus.FAILED;
          this.globalNotificationService.showToast({
            title: this.translateService.instant(
              failed
                ? 'packageManagement.notification.updateFailed'
                : 'packageManagement.notification.updated',
              {name: this.packageName(pkg), version: job.toVersion}
            ),
            type: failed ? 'error' : 'success',
          });
          if (!failed) {
            this.loadPackageFrontend(pkg.id, this.packageName(pkg));
          }
          this.loadCatalogue();
        },
        error: () => this.setPending(pkg.id, false),
      })
    );
  }

  private onBatchError(pkg: PackageListItem, titleKey: string, error: unknown): void {
    this.setPending(pkg.id, false);
    this.logger.error(`Package action failed for '${pkg.id}'.`, error);
    this.globalNotificationService.showToast({
      title: this.translateService.instant(titleKey, {name: this.packageName(pkg)}),
      type: 'error',
    });
  }

  private setPending(packageId: string, pending: boolean): void {
    const next = new Set(this._pending$.getValue());
    if (pending) {
      next.add(packageId);
    } else {
      next.delete(packageId);
    }
    this._pending$.next(next);
  }

  private patchFilters(patch: Partial<PackageFilters>): void {
    this._filters$.next({...this._filters$.getValue(), ...patch});
    // Any filter change invalidates the current page number.
    this._page$.next(1);
  }

  private filter(packages: PackageListItem[], filters: PackageFilters): PackageListItem[] {
    const search = filters.search.trim().toLowerCase();
    return packages.filter(pkg => {
      const matchesType =
        filters.types.length === 0 || filters.types.includes(pkg.type ?? 'plugin');
      if (!matchesType) return false;
      if (!search) return true;
      return [pkg.name, pkg.id, pkg.description, pkg.provider].some(field =>
        (field ?? '').toLowerCase().includes(search)
      );
    });
  }

  private sort(packages: PackageListItem[], sort: PackageSort): PackageListItem[] {
    const byName = (a: PackageListItem, b: PackageListItem): number =>
      this.packageName(a).localeCompare(this.packageName(b));

    switch (sort) {
      case PackageSort.NAME_DESC:
        return [...packages].sort((a, b) => byName(b, a));
      case PackageSort.UPDATED_DESC:
        return [...packages].sort(
          (a, b) => this.latestReleaseTime(b) - this.latestReleaseTime(a) || byName(a, b)
        );
      case PackageSort.NAME_ASC:
      default:
        return [...packages].sort(byName);
    }
  }

  private latestReleaseTime(pkg: PackageListItem): number {
    return pkg.releases.reduce((latest: number, release) => {
      const time = release.date ? new Date(release.date).getTime() : 0;
      return time > latest ? time : latest;
    }, 0);
  }
}
