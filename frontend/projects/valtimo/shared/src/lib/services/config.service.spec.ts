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

import {ComponentFactoryResolver} from '@angular/core';
import {firstValueFrom} from 'rxjs';
import {ExchangeConfiguration, ValtimoConfig} from '../models';
import {ConfigService} from './config.service';

describe('ConfigService exchange configuration', () => {
  const service = (): ConfigService =>
    new ConfigService(
      {featureToggles: {}} as unknown as ValtimoConfig,
      {} as ComponentFactoryResolver
    );

  it('emits null before it is set', async () => {
    expect(await firstValueFrom(service().exchangeConfiguration$)).toBeNull();
  });

  it('emits the configuration that was set', async () => {
    const instance = service();
    const configuration = {enabled: true, url: 'https://exchange.example'} as ExchangeConfiguration;

    instance.setExchangeConfiguration(configuration);

    expect(await firstValueFrom(instance.exchangeConfiguration$)).toBe(configuration);
  });
});
