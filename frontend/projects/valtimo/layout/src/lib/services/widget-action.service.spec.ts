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
import {Router} from '@angular/router';
import {TranslateService} from '@ngx-translate/core';
import {GlobalNotificationService} from '@valtimo/shared';

import {WidgetActionService} from './widget-action.service';

describe('WidgetActionService', () => {
  let service: WidgetActionService;
  let globalNotificationServiceSpy: jasmine.SpyObj<GlobalNotificationService>;
  let routerSpy: jasmine.SpyObj<Router>;
  let windowOpenSpy: jasmine.Spy;

  beforeEach(() => {
    globalNotificationServiceSpy = jasmine.createSpyObj('GlobalNotificationService', ['showToast']);
    routerSpy = jasmine.createSpyObj('Router', ['navigateByUrl']);
    windowOpenSpy = spyOn(window, 'open');

    const translateServiceStub = {
      instant: (key: string) => key,
    } as unknown as TranslateService;

    service = new WidgetActionService(
      globalNotificationServiceSpy,
      routerSpy,
      translateServiceStub
    );
  });

  it('should do nothing without an action', () => {
    service.handleAction(null);

    expect(routerSpy.navigateByUrl).not.toHaveBeenCalled();
    expect(windowOpenSpy).not.toHaveBeenCalled();
    expect(globalNotificationServiceSpy.showToast).not.toHaveBeenCalled();
  });

  it('should navigate to a relative url with the router', () => {
    service.handleAction({navigateTo: '/dossiers/all-cases'});

    expect(routerSpy.navigateByUrl).toHaveBeenCalledWith('/dossiers/all-cases');
  });

  it('should strip the origin from a url of the application itself', () => {
    service.handleAction({navigateTo: `${window.location.origin}/dossiers/all-cases`});

    expect(routerSpy.navigateByUrl).toHaveBeenCalledWith('/dossiers/all-cases');
  });

  it('should open an external url in a new tab', () => {
    service.handleAction({navigateTo: 'https://example.com/iko-view'});

    expect(windowOpenSpy).toHaveBeenCalledWith(
      'https://example.com/iko-view',
      '_blank',
      'noopener,noreferrer'
    );
    expect(routerSpy.navigateByUrl).not.toHaveBeenCalled();
  });

  it('should open a relative url in a new tab when configured to do so', () => {
    service.handleAction({navigateTo: '/dossiers/all-cases', openInNewTab: true});

    expect(windowOpenSpy).toHaveBeenCalledWith(
      '/dossiers/all-cases',
      '_blank',
      'noopener,noreferrer'
    );
    expect(routerSpy.navigateByUrl).not.toHaveBeenCalled();
  });

  it('should resolve the navigateTo of the action from the resolved data', () => {
    service.handleAction(
      {navigateTo: 'ikoViewUrl'},
      {resolved: {ikoViewUrl: '/iko-view/persons/1234'}}
    );

    expect(routerSpy.navigateByUrl).toHaveBeenCalledWith('/iko-view/persons/1234');
  });

  it('should resolve the navigateTo of the action from data without a resolved map', () => {
    service.handleAction({navigateTo: 'ikoViewUrl'}, {ikoViewUrl: '/iko-view/persons/1234'});

    expect(routerSpy.navigateByUrl).toHaveBeenCalledWith('/iko-view/persons/1234');
  });

  it('should fall back to the configured value when it cannot be resolved', () => {
    service.handleAction({navigateTo: '/dossiers/all-cases'}, {resolved: {ikoViewUrl: '/iko'}});

    expect(routerSpy.navigateByUrl).toHaveBeenCalledWith('/dossiers/all-cases');
  });

  it('should show a toast when the navigation target is not a url', () => {
    service.handleAction({navigateTo: 'ikoViewUrl'}, {resolved: {}});

    expect(routerSpy.navigateByUrl).not.toHaveBeenCalled();
    expect(windowOpenSpy).not.toHaveBeenCalled();
    expect(globalNotificationServiceSpy.showToast).toHaveBeenCalledWith(
      jasmine.objectContaining({type: 'error'})
    );
  });

  it('should show a toast for an action that is not supported', () => {
    service.handleAction({processDefinitionKey: 'some-process'});

    expect(globalNotificationServiceSpy.showToast).toHaveBeenCalledWith(
      jasmine.objectContaining({type: 'error'})
    );
  });
});
