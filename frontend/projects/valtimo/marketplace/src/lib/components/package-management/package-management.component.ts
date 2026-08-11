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
import {TranslateModule} from '@ngx-translate/core';
import {ButtonModule, IconModule, IconService, TagModule} from 'carbon-components-angular';
import {Renew16} from '@carbon/icons';
import {Subscription} from 'rxjs';
import {MARKETPLACE_TEST_IDS} from '../../constants';
import {MarketplaceTab, PackageJobStatus} from '../../models';
import {MarketplacePageService} from '../../services/marketplace-page.service';
import {PackageOperationService} from '../../services/package-operation.service';
import {PackageActivityComponent} from '../package-activity/package-activity.component';
import {PackageDiscoverComponent} from '../package-discover/package-discover.component';
import {PackageInstalledComponent} from '../package-installed/package-installed.component';
import {PackageOperationModalComponent} from '../package-operation-modal/package-operation-modal.component';
import {PackageStoresComponent} from '../package-stores/package-stores.component';
import {PackageUpdatesComponent} from '../package-updates/package-updates.component';

@Component({
  standalone: true,
  templateUrl: './package-management.component.html',
  styleUrls: ['./package-management.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Both services are page-scoped: the tab components and the operation modal share one
  // catalogue read and one in-flight operation rather than each holding their own.
  providers: [MarketplacePageService, PackageOperationService],
  imports: [
    CommonModule,
    TranslateModule,
    ButtonModule,
    IconModule,
    TagModule,
    PackageActivityComponent,
    PackageDiscoverComponent,
    PackageInstalledComponent,
    PackageOperationModalComponent,
    PackageStoresComponent,
    PackageUpdatesComponent,
  ],
})
export class PackageManagementComponent implements OnInit, OnDestroy {
  public readonly MarketplaceTab = MarketplaceTab;
  public readonly TABS = [
    MarketplaceTab.DISCOVER,
    MarketplaceTab.INSTALLED,
    MarketplaceTab.UPDATES,
    MarketplaceTab.ACTIVITY,
    MarketplaceTab.STORES,
  ];

  public readonly activeTab$ = this.marketplacePageService.activeTab$;
  public readonly installedPackages$ = this.marketplacePageService.installedPackages$;
  public readonly lastRefreshed$ = this.marketplacePageService.lastRefreshed$;
  public readonly refreshing$ = this.marketplacePageService.refreshing$;
  public readonly systemVersion$ = this.marketplacePageService.systemVersion$;
  public readonly updatesAvailable$ = this.marketplacePageService.updatesAvailable$;

  protected readonly testIds = MARKETPLACE_TEST_IDS;

  private readonly _subscriptions = new Subscription();

  constructor(
    private readonly marketplacePageService: MarketplacePageService,
    private readonly packageOperationService: PackageOperationService,
    private readonly iconService: IconService
  ) {
    this.iconService.registerAll([Renew16]);
  }

  public ngOnInit(): void {
    this.marketplacePageService.loadCatalogue();

    // An operation changes installed/next versions and adds an activity row, so both are
    // re-read when one finishes. Also pulls in the package's frontend bundle on success so
    // its screens appear without a reload.
    this._subscriptions.add(
      this.packageOperationService.finished$.subscribe(job => {
        if (job.status === PackageJobStatus.SUCCEEDED) {
          this.marketplacePageService.loadPackageFrontend(
            job.packageId,
            job.packageName ?? job.packageId
          );
        }
        this.marketplacePageService.loadCatalogue();
        this.marketplacePageService.loadJobs();
      })
    );
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  public onRefresh(): void {
    this.marketplacePageService.refreshCatalogue();
  }

  public onTabSelected(tab: MarketplaceTab): void {
    this.marketplacePageService.setActiveTab(tab);
  }
}
