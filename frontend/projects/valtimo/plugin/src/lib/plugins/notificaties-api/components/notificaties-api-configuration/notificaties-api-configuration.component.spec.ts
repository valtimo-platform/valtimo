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

import {NO_ERRORS_SCHEMA, Pipe, PipeTransform} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {TranslateService} from '@ngx-translate/core';
import {Observable, of, Subject} from 'rxjs';
import {NOTIFICATIES_API_CONFIGURATION_TEST_IDS} from '../../../../constants';
import {PluginManagementService, PluginTranslationService} from '../../../../services';
import {NotificatiesApiAbonnementRegistration, NotificatiesApiConfig} from '../../models';
import {NotificatiesApiConfigurationComponent} from './notificaties-api-configuration.component';

describe('NotificatiesApiConfigurationComponent', () => {
  let component: NotificatiesApiConfigurationComponent;
  let save$: Subject<void>;

  const CONFIGURATION_WITHOUT_AUTHENTICATION = {
    configurationTitle: 'Notificaties API Plugin',
    url: 'https://opennotificaties.example.com/api/v1/',
    callbackUrl: 'https://gzac.example.com/api/v1/notificatiesapi/callback',
  } as NotificatiesApiConfig;

  beforeEach(() => {
    save$ = new Subject<void>();
    component = new NotificatiesApiConfigurationComponent(
      jasmine.createSpyObj('PluginManagementService', {
        getPluginConfigurationsByCategory: of([]),
      }),
      jasmine.createSpyObj('TranslateService', {stream: of('key')}),
      jasmine.createSpyObj('PluginTranslationService', {instant: 'title'})
    );
    component.save$ = save$;
    component.ngOnInit();
  });

  afterEach(() => {
    component.ngOnDestroy();
  });

  it('should not be valid without an authentication plugin configuration', () => {
    const validEmissions: boolean[] = [];
    component.valid.subscribe(valid => validEmissions.push(valid));

    component.formValueChange(CONFIGURATION_WITHOUT_AUTHENTICATION);

    expect(validEmissions).toEqual([false]);
  });

  it('should not save a configuration without an authentication plugin configuration', () => {
    const emittedConfigurations: NotificatiesApiConfig[] = [];
    component.configuration.subscribe(configuration => emittedConfigurations.push(configuration));

    component.formValueChange(CONFIGURATION_WITHOUT_AUTHENTICATION);
    save$.next();

    expect(emittedConfigurations).toEqual([]);
  });

  it('should save a configuration with an authentication plugin configuration', () => {
    const configurationWithAuthentication = {
      ...CONFIGURATION_WITHOUT_AUTHENTICATION,
      authenticationPluginConfiguration: '5474fe57-532a-4050-8d89-32e62ca3e895',
    } as NotificatiesApiConfig;
    const emittedConfigurations: NotificatiesApiConfig[] = [];
    component.configuration.subscribe(configuration => emittedConfigurations.push(configuration));

    component.formValueChange(configurationWithAuthentication);
    save$.next();

    expect(emittedConfigurations).toEqual([configurationWithAuthentication]);
  });

  const CONFIGURATION_WITH_AUTHENTICATION = {
    ...CONFIGURATION_WITHOUT_AUTHENTICATION,
    authenticationPluginConfiguration: '5474fe57-532a-4050-8d89-32e62ca3e895',
  } as NotificatiesApiConfig;

  it('should not save a manual configuration without a shared secret', () => {
    const emittedConfigurations: NotificatiesApiConfig[] = [];
    component.configuration.subscribe(configuration => emittedConfigurations.push(configuration));

    component.formValueChange({
      ...CONFIGURATION_WITH_AUTHENTICATION,
      abonnementRegistration: 'manual',
      authHeader: '  ',
    });
    save$.next();

    expect(emittedConfigurations).toEqual([]);
  });

  it('should save a manual configuration with a shared secret and without a callback URL', () => {
    const manualConfiguration = {
      ...CONFIGURATION_WITH_AUTHENTICATION,
      abonnementRegistration: 'manual',
      authHeader: 'shared-secret',
    } as NotificatiesApiConfig;
    const emittedConfigurations: NotificatiesApiConfig[] = [];
    component.configuration.subscribe(configuration => emittedConfigurations.push(configuration));

    component.formValueChange(manualConfiguration);
    save$.next();

    expect(emittedConfigurations).toEqual([{...manualConfiguration, callbackUrl: null}]);
  });

  it('should save a manual configuration that has no callback URL field', () => {
    const {callbackUrl, ...withoutCallbackUrl} = CONFIGURATION_WITH_AUTHENTICATION;
    const emittedConfigurations: NotificatiesApiConfig[] = [];
    component.configuration.subscribe(configuration => emittedConfigurations.push(configuration));

    component.formValueChange({
      ...withoutCallbackUrl,
      abonnementRegistration: 'manual',
      authHeader: 'shared-secret',
    } as NotificatiesApiConfig);
    save$.next();

    expect(emittedConfigurations.length).toBe(1);
    expect(emittedConfigurations[0].callbackUrl).toBeNull();
  });

  it('should not save an automatic configuration without a callback URL', () => {
    const emittedConfigurations: NotificatiesApiConfig[] = [];
    component.configuration.subscribe(configuration => emittedConfigurations.push(configuration));

    component.formValueChange({
      ...CONFIGURATION_WITH_AUTHENTICATION,
      callbackUrl: '',
      abonnementRegistration: 'automatic',
    });
    save$.next();

    expect(emittedConfigurations).toEqual([]);
  });

  it('should save an automatic configuration without a shared secret', () => {
    const automaticConfiguration = {
      ...CONFIGURATION_WITH_AUTHENTICATION,
      abonnementRegistration: 'automatic',
    } as NotificatiesApiConfig;
    const emittedConfigurations: NotificatiesApiConfig[] = [];
    component.configuration.subscribe(configuration => emittedConfigurations.push(configuration));

    component.formValueChange(automaticConfiguration);
    save$.next();

    expect(emittedConfigurations).toEqual([automaticConfiguration]);
  });
});

@Pipe({name: 'pluginTranslate', standalone: false})
class PluginTranslateStubPipe implements PipeTransform {
  public transform(translateKey: string): Observable<string> {
    return of(translateKey);
  }
}

describe('NotificatiesApiConfigurationComponent template', () => {
  let fixture: ComponentFixture<NotificatiesApiConfigurationComponent>;
  const testIds = NOTIFICATIES_API_CONFIGURATION_TEST_IDS;

  const element = (selector: string): any => fixture.nativeElement.querySelector(selector);
  const byTestId = (testId: string): HTMLElement[] =>
    Array.from(fixture.nativeElement.querySelectorAll(`[data-test-id="${testId}"]`));

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [NotificatiesApiConfigurationComponent, PluginTranslateStubPipe],
      providers: [
        {
          provide: PluginManagementService,
          useValue: {getPluginConfigurationsByCategory: () => of([])},
        },
        {provide: TranslateService, useValue: {stream: () => of('key')}},
        {provide: PluginTranslationService, useValue: {instant: (key: string) => key}},
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
  });

  const render = (abonnementRegistration?: NotificatiesApiAbonnementRegistration): void => {
    fixture = TestBed.createComponent(NotificatiesApiConfigurationComponent);
    fixture.componentInstance.pluginId = 'notificatiesapi';
    fixture.componentInstance.disabled$ = of(false);
    fixture.componentInstance.save$ = new Subject<void>();
    fixture.componentInstance.prefillConfiguration$ = of({
      configurationId: 'b2f4c1d0-0000-4000-8000-000000000001',
      configurationTitle: 'Notificaties API Plugin',
      url: 'https://opennotificaties.example.com/api/v1/',
      callbackUrl: 'https://gzac.example.com/api/v1/notificatiesapi/callback',
      authHeader: '',
      abonnementRegistration,
    });
    fixture.detectChanges();
  };

  const switchToManual = (): void => {
    fixture.componentInstance.formValueChange({
      configurationTitle: 'Notificaties API Plugin',
      url: 'https://opennotificaties.example.com/api/v1/',
      callbackUrl: 'https://gzac.example.com/api/v1/notificatiesapi/callback',
      authHeader: '',
      abonnementRegistration: 'manual',
    } as NotificatiesApiConfig);
    fixture.detectChanges();
  };

  it('should offer automatic and manual abonnement registration, automatic by default', () => {
    render();
    const registrationSelect = element('v-select[name="abonnementRegistration"]');

    expect(registrationSelect).not.toBeNull();
    expect(registrationSelect.defaultSelectionId).toBe('automatic');
    expect(registrationSelect.items.map((item: {id: string}) => item.id)).toEqual([
      'automatic',
      'manual',
    ]);
  });

  it('should keep the authentication header optional and hide the manual panel when automatic', () => {
    render();
    const authHeader = element('v-input[name="authHeader"]');

    expect(authHeader.required).toBeFalse();
    expect(authHeader.title).toBe('authHeader');
    expect(element('v-input[name="callbackUrl"]').required).toBeTrue();
    expect(byTestId(testIds.manualAbonnement).length).toBe(0);
  });

  it('should require the shared secret, hide the callback URL and show the manual panel when manual', () => {
    render('manual');
    switchToManual();

    const authHeader = element('v-input[name="authHeader"]');
    expect(authHeader.required).toBeTrue();
    expect(authHeader.title).toBe('sharedSecret');
    expect(element('v-input[name="callbackUrl"]')).toBeNull();
    expect(byTestId(testIds.manualAbonnement).length).toBe(1);
  });

  it('should show generic help with the placeholder callback URL as soon as manual is selected', () => {
    render('automatic');
    switchToManual();

    expect(byTestId(testIds.manualAbonnementCallbackUrl)[0].textContent.trim()).toBe(
      'https://{gzac-back-end-url}/api/v1/notificatiesapi/callback'
    );
    expect(fixture.nativeElement.textContent).toContain('manualAbonnementDescription');
    expect(fixture.nativeElement.textContent).toContain('manualAbonnementKanalen');
  });
});
