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

import {DatePipe} from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  computed,
  effect,
  Injector,
  OnInit,
  signal,
  TemplateRef,
  viewChild,
} from '@angular/core';
import {Router} from '@angular/router';
import {Information16, Launch16} from '@carbon/icons';
import {TranslateModule, TranslateService} from '@ngx-translate/core';
import {
  BuildingBlockManagementService,
  BuildingBlockManagementUploadModalComponent,
} from '@valtimo/building-block-management';
import {CaseManagementModule} from '@valtimo/case-management';
import {
  CarbonListModule,
  ColumnConfig,
  RenderInPageHeaderDirective,
  VersionService,
  ViewType,
} from '@valtimo/components';
import {
  ButtonModule,
  IconModule,
  IconService,
  LayerModule,
  LinkModule,
  NotificationModule,
  SkeletonModule,
  TagModule,
  TilesModule,
  ToggletipModule,
} from 'carbon-components-angular';
import {EXCHANGE_DETAIL_TEST_IDS} from '../../constants';
import {
  ExchangeCompatibility,
  ExchangeDependency,
  ExchangeEstafetteStage,
  ExchangeInstallRequest,
  ExchangeVersion,
} from '../../models';
import {ExchangeCatalogApiService} from '../../services/exchange-catalog-api.service';
import {ExchangeInstallService} from '../../services/exchange-install.service';
import {
  compareValtimoVersions,
  ESTAFETTE_TAG_TYPES,
  httpUrlOrNull,
  nextEstafetteStage,
} from '../../utils';
import {ExchangeArtifactVisualComponent} from '../exchange-artifact-visual/exchange-artifact-visual.component';
import {ExchangeInstallConfirmModalComponent} from '../exchange-install-confirm-modal/exchange-install-confirm-modal.component';
import {ExchangeScreenshotGalleryComponent} from '../exchange-screenshot-gallery/exchange-screenshot-gallery.component';
import {ExchangeDetailService} from './exchange-detail.service';

@Component({
  standalone: true,
  templateUrl: './exchange-detail.component.html',
  styleUrls: ['./exchange-detail.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    BuildingBlockManagementService,
    ExchangeCatalogApiService,
    ExchangeDetailService,
    ExchangeInstallService,
  ],
  imports: [
    ButtonModule,
    BuildingBlockManagementUploadModalComponent,
    CarbonListModule,
    CaseManagementModule,
    DatePipe,
    ExchangeArtifactVisualComponent,
    ExchangeInstallConfirmModalComponent,
    ExchangeScreenshotGalleryComponent,
    IconModule,
    LayerModule,
    LinkModule,
    NotificationModule,
    RenderInPageHeaderDirective,
    SkeletonModule,
    TagModule,
    TilesModule,
    ToggletipModule,
    TranslateModule,
  ],
})
export class ExchangeDetailComponent implements OnInit {
  protected readonly testIds = EXCHANGE_DETAIL_TEST_IDS;
  protected readonly stageTagTypes = ESTAFETTE_TAG_TYPES;

  protected readonly $dependencyGroups = computed(() => {
    const dependencies = this.detailService.$detail()?.defaultVersion?.dependencies ?? [];
    return groupDependencies(dependencies);
  });

  protected readonly $safeRepositoryUrl = computed(() =>
    httpUrlOrNull(this.detailService.$detail()?.repositoryUrl)
  );

  protected readonly $safePublisherWebsite = computed(() =>
    httpUrlOrNull(this.detailService.$detail()?.publisherOrganizationWebsite)
  );

  protected readonly $screenshots = computed(() =>
    (this.detailService.$detail()?.screenshots ?? []).map(url => ({
      url,
      safe: httpUrlOrNull(url),
    }))
  );

  protected readonly $visibleScreenshots = computed(() =>
    this.$screenshots().filter(
      (screenshot): screenshot is {url: string; safe: string} =>
        !!screenshot.safe && !this.$hiddenScreenshots().has(screenshot.url)
    )
  );

  protected readonly $galleryImages = computed(() =>
    this.$visibleScreenshots().map(screenshot => screenshot.safe)
  );

  protected readonly $galleryIndex = signal(0);
  protected readonly $galleryOpen = signal(false);

  protected readonly $canInstall = computed(() => {
    const detail = this.detailService.$detail();
    return detail?.publicationType !== 'Plugin' && !!detail?.defaultVersion?.installable;
  });

  protected readonly $licenseLabel = computed(() => {
    const detail = this.detailService.$detail();
    if (!detail?.license) return null;
    if (detail.license === 'Other' && detail.licenseOther) return detail.licenseOther;
    return `exchange.license.${detail.license}`;
  });

  private readonly $versionColumn = viewChild.required<TemplateRef<unknown>>('versionColumn');
  private readonly $installColumn = viewChild.required<TemplateRef<unknown>>('installColumn');

  protected readonly $versionFields = computed<Array<ColumnConfig>>(() => [
    {
      key: '',
      label: 'exchange.detail.versions.version',
      viewType: ViewType.TEMPLATE,
      template: this.$versionColumn(),
    },
    {key: 'uploadedAt', label: 'exchange.detail.versions.date', viewType: ViewType.DATE},
    {key: '', label: '', viewType: ViewType.TEMPLATE, template: this.$installColumn()},
  ]);

  protected readonly $versionItems = computed(() => [
    ...(this.detailService.$detail()?.versions ?? []),
  ]);

  protected readonly $hiddenScreenshots = signal<ReadonlySet<string>>(new Set());
  protected readonly $runningVersion = signal<string | null>(null);

  constructor(
    protected readonly detailService: ExchangeDetailService,
    protected readonly installService: ExchangeInstallService,
    private readonly versionService: VersionService,
    private readonly translateService: TranslateService,
    private readonly router: Router,
    private readonly iconService: IconService,
    private readonly changeDetectorRef: ChangeDetectorRef,
    private readonly injector: Injector
  ) {
    this.iconService.registerAll([Information16, Launch16]);
    this.refreshVersionListAfterRender();
  }

  public ngOnInit(): void {
    this.detailService.init();
    this.versionService.getVersion().subscribe({
      next: version => this.$runningVersion.set(version?.version || null),
      error: () => this.$runningVersion.set(null),
    });
  }

  protected onInstall(version: ExchangeVersion | null): void {
    const detail = this.detailService.$detail();
    if (!detail || !version) return;

    const request: ExchangeInstallRequest = {
      publicationId: detail.id,
      publicationName: detail.name,
      artifactId: version.artifactId,
      type: version.manifestType === 'BUILDING_BLOCK' ? 'BUILDING_BLOCK' : 'CASE_DEFINITION',
      versionTag: version.versionTag,
      valtimoVersion: version.valtimoVersion,
      releaseNotes: version.releaseNotes,
      dependencies: version.dependencies,
    };
    this.installService.install(request);
  }

  protected onBackToCatalog(): void {
    void this.router.navigate(['/exchange']);
  }

  protected openGallery(index: number): void {
    this.$galleryIndex.set(index);
    this.$galleryOpen.set(true);
  }

  protected onScreenshotError(url: string): void {
    this.$hiddenScreenshots.update(hidden => new Set(hidden).add(url));
  }

  protected stageCriteria(stage: ExchangeEstafetteStage): Array<string> {
    const criteria = this.translateService.instant(`exchange.estafette.needed.${stage}`);
    return Array.isArray(criteria) ? criteria : [];
  }

  protected nextStage(stage: ExchangeEstafetteStage): ExchangeEstafetteStage | null {
    return nextEstafetteStage(stage);
  }

  // Carbon list leaves its skeleton until a check after its ngAfterViewInit
  private refreshVersionListAfterRender(): void {
    effect(() => {
      if (this.$versionItems().length === 0) return;
      afterNextRender(() => this.changeDetectorRef.detectChanges(), {injector: this.injector});
    });
  }

  protected compatibility(version: ExchangeVersion): ExchangeCompatibility {
    return compareValtimoVersions(version.valtimoVersion, this.$runningVersion());
  }
}

const groupDependencies = (
  dependencies: ReadonlyArray<ExchangeDependency>
): Array<ExchangeDependency> => {
  const order = (type: string): number => (type === 'PLUGIN' ? 0 : 1);

  return [...dependencies].sort(
    (a, b) => order(a.type) - order(b.type) || a.title.localeCompare(b.title)
  );
};

export {groupDependencies};
