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

import {of, Subject} from 'rxjs';
import {NotificatiesApiConfig} from '../../models';
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
});
