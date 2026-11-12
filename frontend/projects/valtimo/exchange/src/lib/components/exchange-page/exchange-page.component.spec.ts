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
import {BuildingBlockManagementService} from '@valtimo/building-block-management';
import {fakeAsync, flush, tick} from '@angular/core/testing';
import {convertToParamMap, ParamMap} from '@angular/router';
import {BehaviorSubject, of, throwError} from 'rxjs';
import {ExchangeArtifact} from '../../models';
import {ExchangePageComponent} from './exchange-page.component';

describe('ExchangePageComponent', () => {
  let component: ExchangePageComponent;
  let api: jasmine.SpyObj<any>;
  let notifications: jasmine.SpyObj<any>;
  let router: jasmine.SpyObj<any>;
  let buildingBlockService: BuildingBlockManagementService;
  let queryParams$: BehaviorSubject<ParamMap>;
  let breadcrumbs: jasmine.SpyObj<any>;
  let pageTitle: jasmine.SpyObj<any>;
  let iframe: jasmine.SpyObj<any>;

  const construct = (): void => {
    const route = {
      queryParamMap: queryParams$,
      snapshot: {
        data: {title: 'Exchange'},
        get queryParamMap(): ParamMap {
          return queryParams$.value;
        },
      },
    };
    component = new ExchangePageComponent(
      api,
      buildingBlockService,
      notifications,
      {instant: (key: string) => key} as any,
      router,
      route as any,
      breadcrumbs,
      pageTitle,
      {nativeElement: document.createElement('div')} as any
    );
    iframe = jasmine.createSpyObj('ExternalPluginIframeComponent', ['navigateTo']);
    (component as any)._iframe = iframe;
    component.ngOnInit();
  };

  const REQUEST = {publicationId: 'pub-1', artifactId: 'art-1'};

  const artifact = (overrides: Partial<ExchangeArtifact> = {}): ExchangeArtifact => ({
    publicationId: 'pub-1',
    publicationName: 'Plan',
    artifactId: 'art-1',
    type: 'CASE_DEFINITION',
    title: 'Plan 1.0.0',
    versionTag: '1.0.0',
    fileName: 'plan.zip',
    valtimoVersion: '13',
    runningValtimoVersion: '13.53.0',
    compatibility: 'COMPATIBLE',
    dependencies: [
      {type: 'BUILDING_BLOCK', key: 'installed-bb', title: 'A', versionTag: '1.0.0'},
      {type: 'BUILDING_BLOCK', key: 'missing-bb', title: 'B', versionTag: null},
      {type: 'PLUGIN', key: 'plugin', title: 'C', versionTag: null},
    ],
    ...overrides,
  });

  const createFile = (): File => new File(['zip'], 'plan.zip', {type: 'application/zip'});

  const create = (
    configuration = {enabled: true, url: 'https://exchange.example.org'},
    queryParams: Record<string, string> = {}
  ): void => {
    api = jasmine.createSpyObj('ExchangeApiService', [
      'getConfiguration',
      'getArtifact',
      'getArtifactContent',
      'buildingBlockInstalled',
    ]);
    api.getConfiguration.and.returnValue(of(configuration));
    api.getArtifact.and.returnValue(of(artifact()));
    api.getArtifactContent.and.returnValue(of(createFile()));
    api.buildingBlockInstalled.and.callFake((key: string) => of(key === 'installed-bb'));
    notifications = jasmine.createSpyObj('GlobalNotificationService', [
      'showToast',
      'showActionable',
    ]);
    router = jasmine.createSpyObj('Router', ['navigate']);
    queryParams$ = new BehaviorSubject(convertToParamMap(queryParams));
    router.navigate.and.callFake((_: unknown, extras: any) => {
      const item = extras?.queryParams?.item;
      queryParams$.next(convertToParamMap(item ? {item} : {}));
      return Promise.resolve(true);
    });
    breadcrumbs = jasmine.createSpyObj('BreadcrumbService', [
      'setSecondBreadcrumb',
      'clearSecondBreadcrumb',
    ]);
    pageTitle = jasmine.createSpyObj('PageTitleService', ['setCustomPageTitle']);
    buildingBlockService = new BuildingBlockManagementService();

    construct();
  };

  afterEach(() => component.ngOnDestroy());

  it('shows the not configured state when the Exchange is disabled', () => {
    create({enabled: false, url: null} as any);

    expect(component.$state()).toBe('disabled');
    expect(component.$catalogUrl()).toBeNull();
  });

  it('shows the not configured state when the configuration is forbidden or missing', () => {
    create();
    component.ngOnDestroy();
    api.getConfiguration.and.returnValue(throwError(() => new HttpErrorResponse({status: 404})));
    construct();

    expect(component.$state()).toBe('disabled');
  });

  it('shows the error state when the configuration fails to load', () => {
    create();
    component.ngOnDestroy();
    api.getConfiguration.and.returnValue(throwError(() => new HttpErrorResponse({status: 500})));
    construct();

    expect(component.$state()).toBe('error');
  });

  it('frames the embedded catalog when the Exchange is enabled', () => {
    create();

    expect(component.$state()).toBe('ready');
    expect(component.$catalogUrl()).toBe('https://exchange.example.org/catalog?embed=valtimo');
  });

  it('frames the item from the URL so a link to an item opens it', () => {
    create(undefined, {item: 'pub 1'});

    expect(component.$catalogUrl()).toBe(
      'https://exchange.example.org/catalog/pub%201?embed=valtimo'
    );
  });

  describe('location sync', () => {
    beforeEach(() => create());

    it('puts an opened item in the URL, then sets the breadcrumb and title', fakeAsync(() => {
      component.onLocationChanged({path: '/catalog?q=tax'});
      component.onLocationChanged({path: '/catalog/pub-1', title: 'Bezwaar'});
      flush();

      expect(router.navigate).toHaveBeenCalledOnceWith(
        [],
        jasmine.objectContaining({queryParams: {item: 'pub-1'}, queryParamsHandling: 'merge'})
      );
      expect(breadcrumbs.setSecondBreadcrumb).toHaveBeenCalledWith(
        jasmine.objectContaining({content: 'Exchange', route: ['/exchange']})
      );
      expect(pageTitle.setCustomPageTitle).toHaveBeenCalledWith('Bezwaar');
      expect(iframe.navigateTo).not.toHaveBeenCalled();
    }));

    it('sets the title when it arrives after the item', fakeAsync(() => {
      component.onLocationChanged({path: '/catalog/pub-1'});
      flush();
      expect(pageTitle.setCustomPageTitle).not.toHaveBeenCalledWith('Bezwaar');

      component.onLocationChanged({path: '/catalog/pub-1', title: 'Bezwaar'});

      expect(router.navigate).toHaveBeenCalledTimes(1);
      expect(pageTitle.setCustomPageTitle).toHaveBeenCalledWith('Bezwaar');
    }));

    it('sends the iframe back to the last list, with its search, when the item leaves the URL', fakeAsync(() => {
      component.onLocationChanged({path: '/catalog?q=tax&type=CASE_DEFINITION'});
      component.onLocationChanged({path: '/catalog/pub-1', title: 'Bezwaar'});
      flush();

      queryParams$.next(convertToParamMap({}));

      expect(iframe.navigateTo).toHaveBeenCalledOnceWith('/catalog?q=tax&type=CASE_DEFINITION');
    }));

    it('opens the item from the URL in the iframe on browser forward', fakeAsync(() => {
      component.onLocationChanged({path: '/catalog'});

      queryParams$.next(convertToParamMap({item: 'pub-2'}));

      expect(iframe.navigateTo).toHaveBeenCalledOnceWith('/catalog/pub-2');
    }));

    it('clears the breadcrumb when back on the list', fakeAsync(() => {
      component.onLocationChanged({path: '/catalog/pub-1', title: 'Bezwaar'});
      flush();
      breadcrumbs.clearSecondBreadcrumb.calls.reset();

      component.onLocationChanged({path: '/catalog'});
      flush();

      expect(router.navigate).toHaveBeenCalledWith(
        [],
        jasmine.objectContaining({queryParams: {item: null}})
      );
      expect(breadcrumbs.clearSecondBreadcrumb).toHaveBeenCalled();
      expect(pageTitle.setCustomPageTitle).toHaveBeenCalledWith('Exchange');
    }));

    it('titles the page Exchange once the configuration is loaded', () => {
      expect(pageTitle.setCustomPageTitle).toHaveBeenCalledWith('Exchange');
    });

    it('clears the breadcrumb when leaving the page', () => {
      component.ngOnDestroy();

      expect(breadcrumbs.clearSecondBreadcrumb).toHaveBeenCalled();
    });
  });

  describe('install request', () => {
    beforeEach(() => create());

    it('opens the confirm modal with the dependency statuses', () => {
      component.onInstallRequested(REQUEST);

      expect(api.getArtifact).toHaveBeenCalledWith('pub-1', 'art-1');
      expect(component.$confirmOpen()).toBeTrue();
      expect(component.$confirmArtifact()?.publicationName).toBe('Plan');
      expect(component.$confirmDependencies().map(status => status.installed)).toEqual([
        true,
        false,
        null,
      ]);
    });

    it('ignores a second request while one is in progress', () => {
      component.onInstallRequested(REQUEST);
      component.onInstallRequested(REQUEST);

      expect(api.getArtifact).toHaveBeenCalledTimes(1);
    });

    it('accepts a new request after the confirm modal is cancelled', () => {
      component.onInstallRequested(REQUEST);
      component.onConfirmCancelled();
      component.onInstallRequested(REQUEST);

      expect(component.$confirmOpen()).toBeTrue();
      expect(api.getArtifact).toHaveBeenCalledTimes(2);
    });

    it('shows the backend message when the artifact cannot be installed', () => {
      api.getArtifact.and.returnValue(
        throwError(
          () => new HttpErrorResponse({status: 422, error: {message: 'Cannot install a plugin'}})
        )
      );

      component.onInstallRequested(REQUEST);

      expect(component.$confirmOpen()).toBeFalse();
      expect(notifications.showToast).toHaveBeenCalledWith(
        jasmine.objectContaining({type: 'error', message: 'Cannot install a plugin'})
      );
    });

    it('shows an error when the Exchange is unavailable and allows a retry', () => {
      api.getArtifact.and.returnValue(throwError(() => new HttpErrorResponse({status: 502})));

      component.onInstallRequested(REQUEST);
      api.getArtifact.and.returnValue(of(artifact()));
      component.onInstallRequested(REQUEST);

      expect(notifications.showToast).toHaveBeenCalledTimes(1);
      expect(component.$confirmOpen()).toBeTrue();
    });
  });

  describe('confirm', () => {
    beforeEach(() => create());

    it('opens the case definition wizard with the downloaded file', () => {
      component.onInstallRequested(REQUEST);

      component.onConfirmed();

      expect(api.getArtifactContent).toHaveBeenCalledWith('pub-1', 'art-1');
      expect(component.$confirmOpen()).toBeFalse();
      expect(component.$caseUploadOpen()).toBeTrue();
      expect(component.$presetFile()?.name).toBe('plan.zip');
    });

    it('opens the building block import modal with the downloaded file', () => {
      api.getArtifact.and.returnValue(of(artifact({type: 'BUILDING_BLOCK', dependencies: []})));
      const showSpy = spyOn(buildingBlockService, 'showUploadModal').and.callThrough();
      component.onInstallRequested(REQUEST);

      component.onConfirmed();

      expect(showSpy).toHaveBeenCalledWith(jasmine.any(File));
      expect(component.$caseUploadOpen()).toBeFalse();
    });

    it('shows an error when the download fails', () => {
      component.onInstallRequested(REQUEST);
      api.getArtifactContent.and.returnValue(
        throwError(() => new HttpErrorResponse({status: 413, error: {message: 'Too large'}}))
      );

      component.onConfirmed();

      expect(component.$caseUploadOpen()).toBeFalse();
      expect(notifications.showToast).toHaveBeenCalledWith(
        jasmine.objectContaining({type: 'error', message: 'Too large'})
      );
    });
  });

  describe('after the import', () => {
    beforeEach(() => create());

    it('shows a success toast and clears the preset after a case definition import', () => {
      component.onInstallRequested(REQUEST);
      component.onConfirmed();

      component.onCaseUploadClosed(true);

      expect(component.$caseUploadOpen()).toBeFalse();
      expect(component.$presetFile()).toBeNull();
      expect(notifications.showActionable).toHaveBeenCalledWith(
        jasmine.objectContaining({type: 'success'})
      );
    });

    it('shows no toast when the case definition wizard is closed without importing', () => {
      component.onCaseUploadClosed(false);

      expect(notifications.showActionable).not.toHaveBeenCalled();
    });

    it('shows a success toast after a building block import', () => {
      buildingBlockService.showUploadModal(createFile());

      buildingBlockService.reload();
      buildingBlockService.hideUploadModal();

      expect(notifications.showActionable).toHaveBeenCalledWith(
        jasmine.objectContaining({type: 'success'})
      );
    });

    it('accepts a new request once the building block modal is closed', () => {
      api.getArtifact.and.returnValue(of(artifact({type: 'BUILDING_BLOCK', dependencies: []})));
      component.onInstallRequested(REQUEST);
      component.onConfirmed();

      buildingBlockService.hideUploadModal();
      component.onInstallRequested(REQUEST);

      expect(api.getArtifact).toHaveBeenCalledTimes(2);
    });
  });

  describe('ready timeout', () => {
    it('flags a load timeout when the iframe never signals ready', fakeAsync(() => {
      create();

      tick(10000);

      expect(component.$loadTimedOut()).toBeTrue();
    }));

    it('does not flag a timeout once the iframe is ready', fakeAsync(() => {
      create();

      component.onReady();
      tick(10000);

      expect(component.$iframeReady()).toBeTrue();
      expect(component.$loadTimedOut()).toBeFalse();
    }));

    it('does not flag a timeout after destroy', fakeAsync(() => {
      create();

      component.ngOnDestroy();
      tick(10000);

      expect(component.$loadTimedOut()).toBeFalse();
    }));
  });

  describe('confirm without artifact', () => {
    it('closes the modal and accepts a new request', () => {
      create();

      component.onConfirmed();
      component.onInstallRequested(REQUEST);

      expect(api.getArtifactContent).not.toHaveBeenCalled();
      expect(api.getArtifact).toHaveBeenCalledTimes(1);
      expect(component.$confirmOpen()).toBeTrue();
    });
  });

  describe('destroy', () => {
    it('stops reacting to building block reloads', () => {
      create();
      buildingBlockService.reload();
      buildingBlockService.reload();
      const calls = notifications.showActionable.calls.count();

      component.ngOnDestroy();
      buildingBlockService.reload();

      expect(notifications.showActionable.calls.count()).toBe(calls);
    });
  });
});
