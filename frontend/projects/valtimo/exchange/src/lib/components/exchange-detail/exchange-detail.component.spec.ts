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

import {CUSTOM_ELEMENTS_SCHEMA, signal} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {provideRouter} from '@angular/router';
import {LoggerTestingModule} from 'ngx-logger/testing';
import {TranslateModule} from '@ngx-translate/core';
import {
  BuildingBlockManagementService,
  BuildingBlockManagementUploadModalComponent,
} from '@valtimo/building-block-management';
import {CaseManagementModule} from '@valtimo/case-management';
import {RenderInPageHeaderDirective, VersionService} from '@valtimo/components';
import {of} from 'rxjs';
import {ExchangeArtifactDto, ExchangePublicationDetail, ExchangePublicationDto} from '../../models';
import {ExchangeCatalogApiService} from '../../services/exchange-catalog-api.service';
import {ExchangeInstallService} from '../../services/exchange-install.service';
import {ESTAFETTE_STAGES, toPublicationDetail} from '../../utils';
import {ExchangeDetailComponent, groupDependencies} from './exchange-detail.component';
import {ExchangeDetailService, ExchangeDetailState} from './exchange-detail.service';

describe('ExchangeDetailComponent', () => {
  let fixture: ComponentFixture<ExchangeDetailComponent>;
  let detailService: {
    $state: ReturnType<typeof signal<ExchangeDetailState>>;
    $detail: ReturnType<typeof signal<ExchangePublicationDetail | null>>;
    init: jasmine.Spy;
    retry: jasmine.Spy;
  };
  let installService: {
    $confirmOpen: ReturnType<typeof signal<boolean>>;
    $summary: ReturnType<typeof signal<null>>;
    $dependencies: ReturnType<typeof signal<Array<unknown>>>;
    $caseUploadOpen: ReturnType<typeof signal<boolean>>;
    $presetFile: ReturnType<typeof signal<File | null>>;
    $errorMessage: ReturnType<typeof signal<string | null>>;
    install: jasmine.Spy;
    cancel: jasmine.Spy;
    confirm: jasmine.Spy;
    onCaseUploadClosed: jasmine.Spy;
  };

  const artifact = (overrides: Partial<ExchangeArtifactDto> = {}): ExchangeArtifactDto => ({
    id: 'a1',
    url: '/api/v1/publications/p1/artifacts/a1',
    default: true,
    versionTag: '1.0.0',
    title: 'Plan',
    manifestType: 'CASE_DEFINITION',
    valtimoVersion: '13.0.0',
    releaseNotes: 'Initial release',
    fileName: 'plan.zip',
    uploadedAt: '2026-03-13T10:00:00Z',
    dependencies: [],
    ...overrides,
  });

  const publication = (
    overrides: Partial<ExchangePublicationDto> = {}
  ): ExchangePublicationDetail =>
    toPublicationDetail({
      id: 'p1',
      name: 'Aanvraag energietoeslag',
      status: 'PUBLISHED',
      publicationType: 'CaseDefinition',
      estafetteStage: 'COMMUNITY',
      tags: [],
      shortDescription: 'Short text',
      description: 'Long text',
      implementationInstructions: 'Do this',
      screenshots: ['https://assets.example/s1.png'],
      repositoryUrl: 'https://github.com/ritense/x',
      license: 'EUPL_1_2',
      publisherOrganization: 'Ritense',
      publisherOrganizationWebsite: 'https://ritense.com',
      artifacts: [artifact()],
      ...overrides,
    });

  const find = (testId: string): HTMLElement | null =>
    fixture.nativeElement.querySelector(`[data-test-id="${testId}"]`);

  const render = (
    detail: ExchangePublicationDetail,
    state: ExchangeDetailState = 'ready'
  ): void => {
    detailService.$detail.set(detail);
    detailService.$state.set(state);
    fixture.detectChanges();
  };

  beforeEach(() => {
    detailService = {
      $state: signal<ExchangeDetailState>('loading'),
      $detail: signal<ExchangePublicationDetail | null>(null),
      init: jasmine.createSpy('init'),
      retry: jasmine.createSpy('retry'),
    };
    installService = {
      $confirmOpen: signal(false),
      $summary: signal(null),
      $dependencies: signal<Array<unknown>>([]),
      $caseUploadOpen: signal(false),
      $presetFile: signal<File | null>(null),
      $errorMessage: signal<string | null>(null),
      install: jasmine.createSpy('install'),
      cancel: jasmine.createSpy('cancel'),
      confirm: jasmine.createSpy('confirm'),
      onCaseUploadClosed: jasmine.createSpy('onCaseUploadClosed'),
    };

    TestBed.configureTestingModule({
      imports: [ExchangeDetailComponent, TranslateModule.forRoot(), LoggerTestingModule],
      providers: [
        provideRouter([]),
        {
          provide: VersionService,
          useValue: {getVersion: () => of({title: 'V', version: '13.53.0'})},
        },
      ],
    });
    TestBed.overrideComponent(ExchangeDetailComponent, {
      remove: {
        imports: [
          CaseManagementModule,
          BuildingBlockManagementUploadModalComponent,
          RenderInPageHeaderDirective,
        ],
      },
      add: {schemas: [CUSTOM_ELEMENTS_SCHEMA]},
    });
    TestBed.overrideComponent(ExchangeDetailComponent, {
      set: {
        providers: [
          {provide: BuildingBlockManagementService, useValue: new BuildingBlockManagementService()},
          {provide: ExchangeCatalogApiService, useValue: {}},
          {provide: ExchangeDetailService, useValue: detailService},
          {provide: ExchangeInstallService, useValue: installService},
        ],
      },
    });
    fixture = TestBed.createComponent(ExchangeDetailComponent);
  });

  it('renders a skeleton while loading', () => {
    fixture.detectChanges();

    expect(find('exchange-detail-skeleton')).not.toBeNull();
  });

  it('renders description and instructions without leading whitespace', () => {
    render(publication());

    expect(find('exchange-detail-description')?.textContent).toBe('Long text');
    expect(find('exchange-detail-implementation-instructions')?.textContent).toBe('Do this');
  });

  it('renders all sections for a published publication', () => {
    render(publication());

    [
      'exchange-detail-short-description',
      'exchange-detail-description',
      'exchange-detail-implementation-instructions',
      'exchange-detail-screenshot',
      'exchange-detail-dependencies',
      'exchange-detail-versions',
      'exchange-detail-sidebar',
      'exchange-detail-publisher',
      'exchange-detail-publisher-website',
      'exchange-detail-repository-link',
    ].forEach(testId => expect(find(testId)).withContext(testId).not.toBeNull());
  });

  it('shows not available for an unavailable publication', () => {
    detailService.$state.set('notAvailable');
    fixture.detectChanges();

    expect(find('exchange-detail-not-available')).not.toBeNull();
    expect(find('exchange-detail-description')).toBeNull();
  });

  it('shows an error with retry when the Exchange is unreachable', () => {
    detailService.$state.set('error');
    fixture.detectChanges();

    find('exchange-detail-retry')?.click();

    expect(find('exchange-detail-error')).not.toBeNull();
    expect(detailService.retry).toHaveBeenCalled();
  });

  it('offers no install for a plugin publication but explains why', () => {
    render(
      publication({
        publicationType: 'Plugin',
        artifacts: [artifact({manifestType: 'PLUGIN', url: null})],
      })
    );

    expect(find('exchange-detail-not-installable')).not.toBeNull();
    expect(find('exchange-detail-install-default')).toBeNull();
    expect(find('exchange-detail-install-version')).toBeNull();
  });

  it('offers no install for an embedded publication', () => {
    render(publication({artifacts: [artifact({url: null})]}));

    expect(find('exchange-detail-not-installable')).not.toBeNull();
    expect(find('exchange-detail-versions')).toBeNull();
  });

  it('does not link an unsafe repository url', () => {
    render(publication({repositoryUrl: 'javascript:alert(1)'}));

    expect(find('exchange-detail-repository-link')).toBeNull();
  });

  it('opens the gallery at the clicked screenshot', () => {
    render(publication());
    const visibleImage = (): Element | null =>
      fixture.nativeElement.querySelector(
        '.cds--modal.is-visible [data-test-id="exchange-gallery-image"]'
      );
    expect(visibleImage()).toBeNull();

    find('exchange-detail-screenshot')?.click();
    fixture.detectChanges();

    expect(visibleImage()?.getAttribute('src')).toBe('https://assets.example/s1.png');
  });

  it('does not link an unsafe screenshot url', () => {
    render(publication({screenshots: ['javascript:alert(1)']}));

    expect(find('exchange-detail-screenshot')).toBeNull();
  });

  it('lists versions default-first and starts an install from a version', () => {
    render(
      publication({
        artifacts: [
          artifact({id: 'a1', default: false, versionTag: '1.0.0'}),
          artifact({id: 'a2', default: true, versionTag: '2.0.0'}),
        ],
      })
    );

    const rows = fixture.nativeElement.querySelectorAll('[data-test-id="exchange-detail-version"]');
    expect(rows[0].textContent).toContain('2.0.0');

    const installButtons = fixture.nativeElement.querySelectorAll(
      '[data-test-id="exchange-detail-install-version"]'
    );
    (installButtons[1] as HTMLElement).click();

    expect(installService.install).toHaveBeenCalledWith(
      jasmine.objectContaining({artifactId: 'a1', versionTag: '1.0.0', type: 'CASE_DEFINITION'})
    );
  });

  it('makes each version expandable to its release notes', () => {
    render(
      publication({
        artifacts: [
          artifact({id: 'a1', versionTag: '1.0.0', releaseNotes: 'Fixed the intake form'}),
          artifact({id: 'a2', default: false, versionTag: '0.9.0', releaseNotes: null}),
        ],
      })
    );
    const releaseNotes = Array.from(
      fixture.nativeElement.querySelectorAll('[data-test-id="exchange-detail-release-notes"]')
    ).map(element => (element as HTMLElement).textContent);

    expect(fixture.nativeElement.querySelectorAll('.cds--table-expand__button').length).toBe(2);
    expect(releaseNotes).toEqual([
      'Fixed the intake form',
      'exchange.detail.versions.noReleaseNotes',
    ]);
  });

  it('shows the newer tag for a version built for a newer Valtimo', () => {
    render(publication({artifacts: [artifact({valtimoVersion: '14.0.0'})]}));
    expect(find('exchange-detail-version-newer-tag')).not.toBeNull();
  });

  it('shows the estafette stage tag with a keyboard-reachable info toggletip', () => {
    render(publication());

    expect(find('exchange-detail-stage-tag')?.textContent).toContain(
      'exchange.estafette.label.COMMUNITY'
    );
    expect(
      find('exchange-detail-stage-info')?.querySelector(
        'button[aria-label="exchange.estafette.info"]'
      )
    ).not.toBeNull();
  });

  it('does not repeat the publication name next to the logo', () => {
    render(publication());

    expect(fixture.nativeElement.querySelector('.exchange-detail__header h3')).toBeNull();
  });

  it('knows the next stage for every stage but the last', () => {
    const component = fixture.componentInstance as unknown as {
      nextStage: (stage: (typeof ESTAFETTE_STAGES)[number]) => string | null;
    };

    expect(ESTAFETTE_STAGES.map(stage => component.nextStage(stage))).toEqual([
      'COMMUNITY',
      'CANDIDATE',
      'HALL_OF_FAME',
      null,
    ]);
  });

  it('shows the install error notification', () => {
    installService.$errorMessage.set('Artifact not found');
    render(publication());

    expect(find('exchange-detail-install-error')?.textContent).toContain('Artifact not found');
  });
});

describe('groupDependencies', () => {
  it('puts plugins first and sorts by title', () => {
    const dependency = (type: string, title: string) => ({
      type,
      key: title,
      title,
      versionTag: null,
    });

    expect(
      groupDependencies([
        dependency('BUILDING_BLOCK', 'Zeta'),
        dependency('PLUGIN', 'Beta'),
        dependency('BUILDING_BLOCK', 'Alpha'),
        dependency('PLUGIN', 'Alpha'),
      ]).map(d => `${d.type}:${d.title}`)
    ).toEqual(['PLUGIN:Alpha', 'PLUGIN:Beta', 'BUILDING_BLOCK:Alpha', 'BUILDING_BLOCK:Zeta']);
  });
});
