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

import {CommonModule} from '@angular/common';
import {HttpErrorResponse} from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  signal,
  ViewChild,
} from '@angular/core';
import {ActivatedRoute, Router} from '@angular/router';
import {TranslateModule, TranslateService} from '@ngx-translate/core';
import {
  BuildingBlockManagementService,
  BuildingBlockManagementUploadModalComponent,
} from '@valtimo/building-block-management';
import {CaseManagementModule} from '@valtimo/case-management';
import {BreadcrumbService, CarbonListModule, PageTitleService} from '@valtimo/components';
import {ExternalPluginIframeComponent} from '@valtimo/plugin';
import {GlobalNotificationService} from '@valtimo/shared';
import {LoadingModule} from 'carbon-components-angular';
import {
  catchError,
  distinctUntilChanged,
  filter,
  forkJoin,
  map,
  Observable,
  of,
  pairwise,
  skip,
  Subscription,
  switchMap,
  take,
  timer,
} from 'rxjs';
import {EXCHANGE_PAGE_TEST_IDS} from '../../constants';
import {ExchangeArtifact, ExchangeDependencyStatus, ExchangeInstallRequest} from '../../models';
import {ExchangeApiService} from '../../services';
import {ExchangeInstallConfirmModalComponent} from '../exchange-install-confirm-modal/exchange-install-confirm-modal.component';

type PageState = 'loading' | 'disabled' | 'error' | 'ready';

const READY_TIMEOUT_MS = 10000;

const CATALOG_PATH = '/catalog';
const DETAIL_PATH = /^\/catalog\/([^/?#]+)/;
const ITEM_PARAM = 'item';

@Component({
  standalone: true,
  selector: 'valtimo-exchange-page',
  templateUrl: './exchange-page.component.html',
  styleUrls: ['./exchange-page.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [BuildingBlockManagementService],
  imports: [
    CommonModule,
    TranslateModule,
    LoadingModule,
    CarbonListModule,
    ExternalPluginIframeComponent,
    CaseManagementModule,
    BuildingBlockManagementUploadModalComponent,
    ExchangeInstallConfirmModalComponent,
  ],
})
export class ExchangePageComponent implements OnInit, OnDestroy {
  protected readonly testIds = EXCHANGE_PAGE_TEST_IDS;

  public readonly $state = signal<PageState>('loading');
  public readonly $catalogUrl = signal<string | null>(null);
  public readonly $iframeReady = signal<boolean>(false);
  public readonly $loadTimedOut = signal<boolean>(false);

  public readonly $confirmOpen = signal<boolean>(false);
  public readonly $confirmArtifact = signal<ExchangeArtifact | null>(null);
  public readonly $confirmDependencies = signal<Array<ExchangeDependencyStatus>>([]);

  public readonly $caseUploadOpen = signal<boolean>(false);
  public readonly $presetFile = signal<File | null>(null);

  @ViewChild(ExternalPluginIframeComponent) private readonly _iframe?: ExternalPluginIframeComponent;

  private readonly _subscriptions = new Subscription();
  private _busy = false;
  /** Last location the embedded catalog reported; null until it reports one. */
  private _iframePath: string | null = null;
  /** Last list location, with search and filters, to return to from a detail page. */
  private _lastCatalogPath = CATALOG_PATH;
  private _itemTitle: string | null = null;

  constructor(
    private readonly exchangeApiService: ExchangeApiService,
    private readonly buildingBlockManagementService: BuildingBlockManagementService,
    private readonly globalNotificationService: GlobalNotificationService,
    private readonly translateService: TranslateService,
    private readonly router: Router,
    private readonly route: ActivatedRoute,
    private readonly breadcrumbService: BreadcrumbService,
    private readonly pageTitleService: PageTitleService,
    private readonly elementRef: ElementRef<HTMLElement>
  ) {}

  public ngOnInit(): void {
    this._subscriptions.add(
      this.exchangeApiService
        .getConfiguration()
        .pipe(
          take(1),
          catchError((error: unknown) =>
            of(
              error instanceof HttpErrorResponse && (error.status === 403 || error.status === 404)
                ? {enabled: false, url: null}
                : null
            )
          )
        )
        .subscribe(configuration => {
          // Arrives after the route settled, so the navigation's title reset is done
          this.applyHeader();

          if (!configuration) {
            this.$state.set('error');
            return;
          }

          if (!configuration.enabled || !configuration.url) {
            this.$state.set('disabled');
            return;
          }

          this.$catalogUrl.set(`${configuration.url}${this.initialPath()}?embed=valtimo`);
          this.$state.set('ready');
          this.startReadyTimeout();
        })
    );

    // The initial value is covered by the iframe's initial URL.
    this._subscriptions.add(
      this.route.queryParamMap
        .pipe(
          map(params => params.get(ITEM_PARAM)),
          distinctUntilChanged(),
          skip(1)
        )
        .subscribe(item => this.showItemInIframe(item))
    );

    this._subscriptions.add(
      this.buildingBlockManagementService.reload$
        .pipe(skip(1))
        .subscribe(() =>
          this.showInstalledToast(
            'exchange.install.successBuildingBlock',
            '/building-block-management'
          )
        )
    );

    this._subscriptions.add(
      this.buildingBlockManagementService.showUploadModal$
        .pipe(
          pairwise(),
          filter(([wasOpen, isOpen]) => wasOpen && !isOpen)
        )
        .subscribe(() => (this._busy = false))
    );
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
    this.breadcrumbService.clearSecondBreadcrumb();
  }

  public onReady(): void {
    this.$iframeReady.set(true);
  }

  /** Mirrors the embedded catalog's location in this page's URL, breadcrumb and title. */
  public onLocationChanged(location: {path: string; title?: string}): void {
    const previousItem = this._iframePath === null ? undefined : this.itemOf(this._iframePath);
    const item = this.itemOf(location.path);

    this._iframePath = location.path;
    if (item === null && location.path.startsWith(CATALOG_PATH)) {
      this._lastCatalogPath = location.path;
    }
    this._itemTitle = item === null ? null : (location.title ?? (item === previousItem ? this._itemTitle : null));

    if (previousItem !== undefined && item !== previousItem) this.scrollToTop();

    if (this.route.snapshot.queryParamMap.get(ITEM_PARAM) === item) {
      this.applyHeader();
      return;
    }

    // Title and breadcrumb are applied after navigating: a navigation resets the page title.
    void this.router
      .navigate([], {
        relativeTo: this.route,
        queryParams: {[ITEM_PARAM]: item},
        queryParamsHandling: 'merge',
      })
      .then(() => this.applyHeader());
  }

  public onInstallRequested(request: ExchangeInstallRequest): void {
    if (this._busy) return;
    this._busy = true;

    this.exchangeApiService
      .getArtifact(request.publicationId, request.artifactId)
      .pipe(
        switchMap(artifact =>
          this.resolveDependencies(artifact).pipe(map(statuses => ({artifact, statuses})))
        ),
        take(1)
      )
      .subscribe({
        next: ({artifact, statuses}) => {
          this.$confirmArtifact.set(artifact);
          this.$confirmDependencies.set(statuses);
          this.$confirmOpen.set(true);
        },
        error: (error: unknown) => this.onFailed(error),
      });
  }

  public onConfirmCancelled(): void {
    this.$confirmOpen.set(false);
    this._busy = false;
  }

  public onConfirmed(): void {
    const artifact = this.$confirmArtifact();
    this.$confirmOpen.set(false);
    if (!artifact) {
      this._busy = false;
      return;
    }

    this.exchangeApiService
      .getArtifactContent(artifact.publicationId, artifact.artifactId)
      .pipe(take(1))
      .subscribe({
        next: file => this.startImport(artifact, file),
        error: (error: unknown) => this.onFailed(error),
      });
  }

  public onCaseUploadClosed(uploaded: boolean): void {
    this.$caseUploadOpen.set(false);
    this.$presetFile.set(null);
    this._busy = false;

    if (uploaded)
      this.showInstalledToast('exchange.install.successCaseDefinition', '/case-management');
  }

  private initialPath(): string {
    const item = this.route.snapshot.queryParamMap.get(ITEM_PARAM);
    return item ? `${CATALOG_PATH}/${encodeURIComponent(item)}` : CATALOG_PATH;
  }

  private itemOf(path: string): string | null {
    const match = DETAIL_PATH.exec(path);
    return match ? decodeURIComponent(match[1]) : null;
  }

  /** Breadcrumb or browser history changed the item; ask the iframe to follow. */
  private showItemInIframe(item: string | null): void {
    if (this._iframePath === null || this.itemOf(this._iframePath) === item) return;

    this._iframe?.navigateTo(
      item === null ? this._lastCatalogPath : `${CATALOG_PATH}/${encodeURIComponent(item)}`
    );
  }

  private applyHeader(): void {
    const pageTitle = this.translateService.instant(this.route.snapshot.data?.['title'] ?? '');

    if (this._iframePath === null || this.itemOf(this._iframePath) === null) {
      this.breadcrumbService.clearSecondBreadcrumb();
      this.pageTitleService.setCustomPageTitle(pageTitle);
      return;
    }

    this.breadcrumbService.setSecondBreadcrumb({
      content: pageTitle,
      route: ['/exchange'],
      href: '/exchange',
    });
    this.pageTitleService.setCustomPageTitle(this._itemTitle ?? pageTitle);
  }

  /** The iframe grows with its content, so the page scrolls; a new view starts at its top. */
  private scrollToTop(): void {
    let element = this.elementRef.nativeElement.parentElement;
    while (element && !this.isScrollable(element)) element = element.parentElement;
    (element ?? document.scrollingElement)?.scrollTo({top: 0});
  }

  private isScrollable(element: HTMLElement): boolean {
    const overflowY = getComputedStyle(element).overflowY;
    return (
      (overflowY === 'auto' || overflowY === 'scroll') && element.scrollHeight > element.clientHeight
    );
  }

  private startImport(artifact: ExchangeArtifact, file: File): void {
    if (artifact.type === 'CASE_DEFINITION') {
      this.$presetFile.set(file);
      this.$caseUploadOpen.set(true);
      return;
    }

    this.buildingBlockManagementService.showUploadModal(file);
  }

  private resolveDependencies(
    artifact: ExchangeArtifact
  ): Observable<Array<ExchangeDependencyStatus>> {
    if (artifact.dependencies.length === 0) return of([]);

    return forkJoin(
      artifact.dependencies.map(dependency =>
        dependency.type === 'BUILDING_BLOCK'
          ? this.exchangeApiService
              .buildingBlockInstalled(dependency.key, dependency.versionTag)
              .pipe(map(installed => ({dependency, installed})))
          : of({dependency, installed: null})
      )
    );
  }

  private startReadyTimeout(): void {
    this._subscriptions.add(
      timer(READY_TIMEOUT_MS).subscribe(() => {
        if (!this.$iframeReady()) this.$loadTimedOut.set(true);
      })
    );
  }

  private onFailed(error: unknown): void {
    this._busy = false;
    const backendMessage =
      error instanceof HttpErrorResponse
        ? (error.error as {message?: string} | null)?.message
        : null;

    this.globalNotificationService.showToast({
      type: 'error',
      title: this.translateService.instant('exchange.install.error'),
      message: backendMessage ?? undefined,
    });
  }

  private showInstalledToast(messageKey: string, route: string): void {
    this.globalNotificationService.showActionable({
      type: 'success',
      title: this.translateService.instant('exchange.install.success'),
      message: this.translateService.instant(messageKey),
      actions: [
        {
          text: this.translateService.instant('exchange.install.viewInstalled'),
          click: () => this.router.navigate([route]),
        },
      ],
    });
  }
}
