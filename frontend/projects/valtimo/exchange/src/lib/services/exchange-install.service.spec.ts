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
import {Router} from '@angular/router';
import {TranslateService} from '@ngx-translate/core';
import {
  BuildingBlockManagementService,
  ImportedBuildingBlockDefinition,
} from '@valtimo/building-block-management';
import {VersionService} from '@valtimo/components';
import {GlobalNotificationService} from '@valtimo/shared';
import {BehaviorSubject, of, Subject, throwError} from 'rxjs';
import {ExchangeInstallRequest} from '../models';
import {ExchangeInstallApiService} from './exchange-install-api.service';
import {ExchangeInstallService} from './exchange-install.service';

describe('ExchangeInstallService', () => {
  let installApi: jasmine.SpyObj<ExchangeInstallApiService>;
  let buildingBlocks: {
    importFinished$: Subject<Array<ImportedBuildingBlockDefinition>>;
    showUploadModal$: BehaviorSubject<boolean>;
    showUploadModal: jasmine.Spy;
  };
  let notifications: jasmine.SpyObj<GlobalNotificationService>;
  let router: jasmine.SpyObj<Router>;
  let service: ExchangeInstallService;

  const file = new File(['zip'], 'plan.zip');
  const request = (overrides: Partial<ExchangeInstallRequest> = {}): ExchangeInstallRequest => ({
    publicationId: 'p1',
    publicationName: 'Plan',
    artifactId: 'a1',
    type: 'CASE_DEFINITION',
    versionTag: '1.0.0',
    valtimoVersion: '14.0.0',
    releaseNotes: '  Fixed the intake form\n',
    dependencies: [
      {type: 'BUILDING_BLOCK', key: 'bb', title: 'Block', versionTag: '1.0.0'},
      {type: 'PLUGIN', key: 'pl', title: 'Plugin', versionTag: null},
    ],
    ...overrides,
  });

  beforeEach(() => {
    installApi = jasmine.createSpyObj('ExchangeInstallApiService', [
      'getArtifactContent',
      'buildingBlockStatus',
      'pluginStatus',
    ]);
    installApi.buildingBlockStatus.and.returnValue(of('NOT_INSTALLED'));
    installApi.pluginStatus.and.returnValue(of('CONFIGURED'));
    installApi.getArtifactContent.and.returnValue(of(file));
    buildingBlocks = {
      importFinished$: new Subject<Array<ImportedBuildingBlockDefinition>>(),
      showUploadModal$: new BehaviorSubject<boolean>(false),
      showUploadModal: jasmine.createSpy('showUploadModal'),
    };
    notifications = jasmine.createSpyObj('GlobalNotificationService', [
      'showActionable',
      'showToast',
    ]);
    router = jasmine.createSpyObj('Router', ['navigate']);
    const translate = {instant: (key: string) => key} as unknown as TranslateService;
    const version = {
      getVersion: () => of({title: 'Valtimo', version: '13.53.0'}),
    } as VersionService;

    service = new ExchangeInstallService(
      installApi,
      buildingBlocks as unknown as BuildingBlockManagementService,
      version,
      notifications,
      translate,
      router
    );
  });

  it('resolves dependency statuses and compatibility, then opens the modal', () => {
    service.install(request());

    expect(installApi.buildingBlockStatus).toHaveBeenCalledOnceWith('bb', '1.0.0');
    expect(installApi.pluginStatus).toHaveBeenCalledOnceWith('pl');
    expect(service.$dependencies().map(status => status.state)).toEqual([
      'NOT_INSTALLED',
      'CONFIGURED',
    ]);
    expect(service.$summary()?.compatibility).toBe('NEWER');
    expect(service.$summary()?.runningValtimoVersion).toBe('13.53.0');
    expect(service.$summary()?.releaseNotes).toBe('Fixed the intake form');
    expect(service.$confirmOpen()).toBeTrue();
  });

  it('ignores a second install while busy', () => {
    service.install(request());
    service.install(request({artifactId: 'a2'}));

    expect(installApi.buildingBlockStatus).toHaveBeenCalledTimes(1);
  });

  it('allows installing again after cancelling', () => {
    service.install(request());
    service.cancel();
    service.install(request());

    expect(installApi.buildingBlockStatus).toHaveBeenCalledTimes(2);
  });

  it('hands a downloaded case definition to the wizard with the file preset', () => {
    service.install(request());
    service.confirm();

    expect(installApi.getArtifactContent).toHaveBeenCalledWith('p1', 'a1');
    expect(service.$confirmOpen()).toBeFalse();
    expect(service.$presetFile()).toBe(file);
    expect(service.$caseUploadOpen()).toBeTrue();
  });

  it('hands a downloaded building block to the upload modal', () => {
    service.install(request({type: 'BUILDING_BLOCK', dependencies: []}));
    service.confirm();

    expect(buildingBlocks.showUploadModal).toHaveBeenCalledWith(file);
    expect(service.$caseUploadOpen()).toBeFalse();
  });

  it('shows the backend message when the download fails and allows a new attempt', () => {
    installApi.getArtifactContent.and.returnValue(
      throwError(() => new HttpErrorResponse({status: 502, error: {message: 'Exchange is down'}}))
    );
    service.install(request());
    service.confirm();

    expect(service.$errorMessage()).toBe('Exchange is down');

    service.install(request());
    expect(service.$confirmOpen()).toBeTrue();
    expect(service.$errorMessage()).toBeNull();
  });

  it('falls back to a generic message for a 422', () => {
    installApi.getArtifactContent.and.returnValue(
      throwError(() => new HttpErrorResponse({status: 422, error: null}))
    );
    service.install(request());
    service.confirm();

    expect(service.$errorMessage()).toBe('exchange.install.error');
  });

  it('opens the imported case definition after a case import', () => {
    service.install(request());
    service.confirm();
    service.onCaseDefinitionImported({
      caseDefinitionKey: 'energy-subsidy',
      caseDefinitionVersionTag: '1.0.0',
    });
    service.onCaseUploadClosed(true);

    expect(router.navigate).toHaveBeenCalledWith([
      '/case-management',
      'case',
      'energy-subsidy',
      'version',
      '1.0.0',
    ]);
    expect(notifications.showToast).toHaveBeenCalled();
    expect(service.$caseUploadOpen()).toBeFalse();
  });

  it('falls back to a toast linking to case management when the import is unknown', () => {
    service.install(request());
    service.confirm();
    service.onCaseUploadClosed(true);

    expect(router.navigate).not.toHaveBeenCalled();
    const toast = notifications.showActionable.calls.mostRecent().args[0];
    (toast.actions?.[0].click as (event: unknown) => void)({});
    expect(router.navigate).toHaveBeenCalledWith(['/case-management']);
  });

  it('shows no toast and does not navigate when the wizard closes without uploading', () => {
    service.onCaseDefinitionImported({caseDefinitionKey: 'x', caseDefinitionVersionTag: '1.0.0'});
    service.onCaseUploadClosed(false);

    expect(notifications.showActionable).not.toHaveBeenCalled();
    expect(notifications.showToast).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('opens the imported building block after a building block import', () => {
    buildingBlocks.importFinished$.next([{key: 'income-check', versionTag: '1.0.0'}]);

    expect(router.navigate).toHaveBeenCalledWith([
      '/building-block-management',
      'building-block',
      'income-check',
      'version',
      '1.0.0',
      'general',
    ]);
    expect(notifications.showToast).toHaveBeenCalled();
  });

  it('falls back to a toast linking to building blocks when the import is unknown', () => {
    buildingBlocks.importFinished$.next([]);

    const toast = notifications.showActionable.calls.mostRecent().args[0];
    (toast.actions?.[0].click as (event: unknown) => void)({});
    expect(router.navigate).toHaveBeenCalledWith(['/building-block-management']);
  });

  it('frees the busy guard when the building block modal closes', () => {
    service.install(request({type: 'BUILDING_BLOCK', dependencies: []}));
    service.confirm();
    buildingBlocks.showUploadModal$.next(true);
    buildingBlocks.showUploadModal$.next(false);
    service.install(request({dependencies: []}));

    expect(service.$confirmOpen()).toBeTrue();
  });
});
