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

import {HttpErrorResponse} from '@angular/common/http';
import {Injectable, OnDestroy, signal} from '@angular/core';
import {Router} from '@angular/router';
import {TranslateService} from '@ngx-translate/core';
import {
  BUILDING_BLOCK_MANAGEMENT_TABS,
  BuildingBlockManagementService,
  ImportedBuildingBlockDefinition,
} from '@valtimo/building-block-management';
import {ImportedCaseDefinition} from '@valtimo/case-management';
import {VersionService} from '@valtimo/components';
import {GlobalNotificationService} from '@valtimo/shared';
import {
  catchError,
  forkJoin,
  map,
  Observable,
  of,
  pairwise,
  filter,
  Subscription,
  switchMap,
  take,
} from 'rxjs';
import {
  ExchangeDependencyState,
  ExchangeDependencyStatus,
  ExchangeInstallRequest,
  ExchangeInstallSummary,
} from '../models';
import {compareValtimoVersions} from '../utils';
import {ExchangeInstallApiService} from './exchange-install-api.service';

@Injectable()
export class ExchangeInstallService implements OnDestroy {
  public readonly $confirmOpen = signal<boolean>(false);
  public readonly $summary = signal<ExchangeInstallSummary | null>(null);
  public readonly $dependencies = signal<Array<ExchangeDependencyStatus>>([]);
  public readonly $caseUploadOpen = signal<boolean>(false);
  public readonly $presetFile = signal<File | null>(null);
  public readonly $errorMessage = signal<string | null>(null);

  private readonly _subscriptions = new Subscription();
  private _busy = false;
  private _request: ExchangeInstallRequest | null = null;
  private _importedCase: ImportedCaseDefinition | null = null;

  constructor(
    private readonly installApiService: ExchangeInstallApiService,
    private readonly buildingBlockManagementService: BuildingBlockManagementService,
    private readonly versionService: VersionService,
    private readonly globalNotificationService: GlobalNotificationService,
    private readonly translateService: TranslateService,
    private readonly router: Router
  ) {
    this._subscriptions.add(
      this.buildingBlockManagementService.importFinished$.subscribe(imported =>
        this.onBuildingBlockImported(imported)
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
  }

  public install(request: ExchangeInstallRequest): void {
    if (this._busy) return;
    this._busy = true;
    this.$errorMessage.set(null);

    forkJoin({
      statuses: this.resolveDependencies(request),
      running: this.versionService.getVersion().pipe(
        map(version => version?.version ?? null),
        catchError(() => of(null))
      ),
    })
      .pipe(take(1))
      .subscribe(({statuses, running}) => {
        this._request = request;
        this.$summary.set({
          publicationName: request.publicationName,
          type: request.type,
          versionTag: request.versionTag || null,
          valtimoVersion: request.valtimoVersion || null,
          compatibility: compareValtimoVersions(request.valtimoVersion, running),
          runningValtimoVersion: running,
          releaseNotes: request.releaseNotes.trim() || null,
        });
        this.$dependencies.set(statuses);
        this.$confirmOpen.set(true);
      });
  }

  public cancel(): void {
    this.$confirmOpen.set(false);
    this._request = null;
    this._busy = false;
  }

  public confirm(): void {
    const request = this._request;
    this.$confirmOpen.set(false);
    if (!request) {
      this._busy = false;
      return;
    }

    this.installApiService
      .getArtifactContent(request.publicationId, request.artifactId)
      .pipe(take(1))
      .subscribe({
        next: file => this.startImport(request, file),
        error: (error: unknown) => this.onFailed(error),
      });
  }

  public onCaseDefinitionImported(imported: ImportedCaseDefinition): void {
    this._importedCase = imported;
  }

  public onCaseUploadClosed(uploaded: boolean): void {
    const imported = this._importedCase;
    this._importedCase = null;
    this.$caseUploadOpen.set(false);
    this.$presetFile.set(null);
    this._busy = false;

    if (!uploaded) return;

    if (imported) {
      this.openInstalled('exchange.install.successCaseDefinition', [
        '/case-management',
        'case',
        imported.caseDefinitionKey,
        'version',
        imported.caseDefinitionVersionTag,
      ]);
      return;
    }

    this.showInstalledToast('exchange.install.successCaseDefinition', '/case-management');
  }

  private startImport(request: ExchangeInstallRequest, file: File): void {
    if (request.type === 'CASE_DEFINITION') {
      this.$presetFile.set(file);
      this.$caseUploadOpen.set(true);
      return;
    }

    this.buildingBlockManagementService.showUploadModal(file);
  }

  private resolveDependencies(
    request: ExchangeInstallRequest
  ): Observable<Array<ExchangeDependencyStatus>> {
    if (request.dependencies.length === 0) return of([]);

    return forkJoin(
      request.dependencies.map(dependency => {
        const state$: Observable<ExchangeDependencyState> =
          dependency.type === 'BUILDING_BLOCK'
            ? this.installApiService.buildingBlockStatus(dependency.key, dependency.versionTag)
            : this.installApiService.pluginStatus(dependency.key);
        return state$.pipe(map((state): ExchangeDependencyStatus => ({dependency, state})));
      })
    );
  }

  private onFailed(error: unknown): void {
    this._busy = false;
    this._request = null;
    const backendMessage =
      error instanceof HttpErrorResponse
        ? (error.error as {message?: string} | null)?.message
        : null;

    this.$errorMessage.set(
      backendMessage ?? this.translateService.instant('exchange.install.error')
    );
  }

  private onBuildingBlockImported(imported: Array<ImportedBuildingBlockDefinition>): void {
    if (imported.length !== 1) {
      this.showInstalledToast(
        'exchange.install.successBuildingBlock',
        '/building-block-management'
      );
      return;
    }

    const [{key, versionTag}] = imported;
    this.openInstalled('exchange.install.successBuildingBlock', [
      '/building-block-management',
      'building-block',
      key,
      'version',
      versionTag,
      BUILDING_BLOCK_MANAGEMENT_TABS.GENERAL,
    ]);
  }

  private openInstalled(messageKey: string, commands: Array<string>): void {
    void this.router.navigate(commands);
    this.globalNotificationService.showToast({
      type: 'success',
      title: this.translateService.instant('exchange.install.success'),
      caption: this.translateService.instant(messageKey),
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
