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
import {ActivatedRoute, Router} from '@angular/router';
import {TranslateModule} from '@ngx-translate/core';
import {
  ButtonModule,
  IconModule,
  IconService,
  LoadingModule,
  TagModule,
} from 'carbon-components-angular';
import {ArrowLeft16, Launch16} from '@carbon/icons';
import {BehaviorSubject, map, Observable, Subscription, switchMap} from 'rxjs';
import {MARKETPLACE_TEST_IDS} from '../../constants';
import {PackageJob, PackageListItem, PackageRelease, PackageTrust} from '../../models';
import {PackageOperationService} from '../../services/package-operation.service';
import {PackageService} from '../../services/package.service';
import {PackageOperationModalComponent} from '../package-operation-modal/package-operation-modal.component';

/** Which section of the detail page is showing. */
enum PackageDetailTab {
  OVERVIEW = 'overview',
  VERSIONS = 'versions',
  REQUIREMENTS = 'requirements',
  TRUST = 'trust',
}

@Component({
  standalone: true,
  templateUrl: './package-detail.component.html',
  styleUrls: ['./package-detail.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [PackageOperationService],
  imports: [
    CommonModule,
    TranslateModule,
    ButtonModule,
    IconModule,
    LoadingModule,
    TagModule,
    PackageOperationModalComponent,
  ],
})
export class PackageDetailComponent implements OnInit, OnDestroy {
  public readonly PackageDetailTab = PackageDetailTab;
  public readonly PackageTrust = PackageTrust;

  public readonly activeTab$ = new BehaviorSubject<PackageDetailTab>(PackageDetailTab.OVERVIEW);
  public readonly loading$ = new BehaviorSubject<boolean>(true);
  public readonly notFound$ = new BehaviorSubject<boolean>(false);
  public readonly package$ = new BehaviorSubject<PackageListItem | null>(null);
  public readonly jobs$ = new BehaviorSubject<PackageJob[]>([]);

  protected readonly testIds = MARKETPLACE_TEST_IDS;

  private readonly _subscriptions = new Subscription();

  constructor(
    private readonly packageService: PackageService,
    private readonly packageOperationService: PackageOperationService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly iconService: IconService
  ) {
    this.iconService.registerAll([ArrowLeft16, Launch16]);
  }

  public ngOnInit(): void {
    this._subscriptions.add(
      this.packageId$
        .pipe(switchMap(packageId => this.packageService.getPackage(packageId)))
        .subscribe({
          next: pkg => {
            this.package$.next(pkg);
            this.loading$.next(false);
          },
          error: () => {
            // A package can legitimately be gone: the catalogue is a cache of remote
            // stores, so a link can outlive the package it points at.
            this.notFound$.next(true);
            this.loading$.next(false);
          },
        })
    );

    this._subscriptions.add(
      this.packageId$
        .pipe(switchMap(packageId => this.packageService.getPackageJobs(packageId)))
        .subscribe({next: page => this.jobs$.next(page.content)})
    );

    // Re-read the package after an operation so installed/next version are current.
    this._subscriptions.add(this.packageOperationService.finished$.subscribe(() => this.reload()));
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  public onBack(): void {
    this.router.navigate(['/marketplace']);
  }

  public onInstall(version?: string): void {
    const pkg = this.package$.getValue();
    if (pkg) this.packageOperationService.startInstall(pkg, version);
  }

  public onSelectTab(tab: PackageDetailTab): void {
    this.activeTab$.next(tab);
  }

  public onUninstall(): void {
    const pkg = this.package$.getValue();
    if (pkg) this.packageOperationService.startUninstall(pkg);
  }

  public onUpdate(version?: string): void {
    const pkg = this.package$.getValue();
    if (pkg) this.packageOperationService.startUpdate(pkg, version);
  }

  /**
   * What the button in a release row should offer. A release that this Valtimo cannot run
   * offers nothing; the currently installed one offers nothing either.
   */
  public releaseAction(pkg: PackageListItem, release: PackageRelease): 'install' | 'switch' | null {
    if (!release.compatible) return null;
    if (release.version === pkg.installedVersion) return null;
    return pkg.installedVersion ? 'switch' : 'install';
  }

  private get packageId$(): Observable<string> {
    return this.route.paramMap.pipe(map(params => params.get('id') ?? ''));
  }

  private reload(): void {
    const pkg = this.package$.getValue();
    if (!pkg) return;
    this.packageService.getPackage(pkg.id).subscribe({
      next: reloaded => this.package$.next(reloaded),
    });
    this.packageService.getPackageJobs(pkg.id).subscribe({
      next: page => this.jobs$.next(page.content),
    });
  }
}
