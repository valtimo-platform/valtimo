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

import {HttpClient} from '@angular/common/http';
import {Injector} from '@angular/core';
import {DomSanitizer} from '@angular/platform-browser';
import {TranslateService} from '@ngx-translate/core';
import {ConfigService} from '@valtimo/shared';
import {NGXLogger} from 'ngx-logger';
import {of, throwError} from 'rxjs';
import {initializerFactory} from './init';

describe('initializerFactory exchange handling', () => {
  const CSP_META_ID = 'CSP_META';
  let directives: Record<string, string[]>;
  let patchFeatureToggles: jasmine.Spy;
  let setExchangeConfiguration: jasmine.Spy;
  let httpGet: jasmine.Spy;

  const run = async (
    exchangeResponse: unknown,
    apiBase = 'https://api.example/'
  ): Promise<void> => {
    directives = {'frame-src': ["'self'"], 'img-src': ["'self'"], 'connect-src': ["'self'"]};
    patchFeatureToggles = jasmine.createSpy('patchFeatureToggles');
    setExchangeConfiguration = jasmine.createSpy('setExchangeConfiguration');
    httpGet = jasmine.createSpy('get').and.callFake((url: string) => {
      if (url.endsWith('v1/exchange/configuration')) {
        return exchangeResponse instanceof Error
          ? throwError(() => exchangeResponse)
          : of(exchangeResponse);
      }
      if (url.endsWith('v1/external-plugin/host-origins')) return of([]);
      return throwError(() => new Error('unavailable'));
    });
    const adminSettings = {
      getAccentColors: () => throwError(() => new Error('n/a')),
      getMenuConfiguration: () => throwError(() => new Error('n/a')),
    };
    const injector = {
      get: (token: unknown) => (token === HttpClient ? {get: httpGet} : adminSettings),
    } as unknown as Injector;
    const configService = {
      config: {
        authentication: {initializer: () => () => Promise.resolve()},
        valtimoApi: {endpointUri: apiBase},
        csp: {directives},
        menu: {menuItems: []},
      },
      initializers: [],
      patchFeatureToggles,
      setExchangeConfiguration,
    } as unknown as ConfigService;
    const logger = jasmine.createSpyObj<NGXLogger>('NGXLogger', ['debug', 'log', 'warn']);
    const sanitizer = {sanitize: (_c: unknown, value: string) => value} as DomSanitizer;

    const initializers = initializerFactory(
      configService,
      injector,
      logger,
      {} as TranslateService,
      document,
      sanitizer
    ) as unknown as (() => Promise<void>)[];
    await initializers[2]();
  };

  afterEach(() => document.getElementById(CSP_META_ID)?.remove());

  it('enables Exchange and keeps its origins out of frame-src when enabled', async () => {
    await run({
      enabled: true,
      url: 'https://exchange.example/app',
      assetOrigins: ['https://cdn.example/bucket/exchange', 'https://other.example'],
    });

    expect(setExchangeConfiguration).toHaveBeenCalled();
    expect(patchFeatureToggles).toHaveBeenCalledWith({enableExchange: true});
    expect(directives['frame-src']).toEqual(["'self'"]);
    expect(directives['connect-src']).toEqual(["'self'", 'https://exchange.example']);
    expect(directives['img-src']).toEqual([
      "'self'",
      'https://exchange.example',
      'https://cdn.example/bucket/exchange/',
      'https://other.example/',
    ]);
  });

  it('does nothing when disabled', async () => {
    await run({enabled: false, url: 'https://exchange.example'});

    expect(setExchangeConfiguration).not.toHaveBeenCalled();
    expect(patchFeatureToggles).not.toHaveBeenCalledWith({enableExchange: true});
    expect(directives['connect-src']).toEqual(["'self'"]);
  });

  it('does not enable when enabled without a url', async () => {
    await run({enabled: true});

    expect(patchFeatureToggles).not.toHaveBeenCalledWith({enableExchange: true});
  });

  it('treats a failed request as not configured', async () => {
    await run(new Error('boom'));

    expect(setExchangeConfiguration).not.toHaveBeenCalled();
    expect(directives['img-src']).toEqual(["'self'"]);
  });

  it('does not request the configuration without an api base', async () => {
    await run({enabled: true, url: 'https://exchange.example'}, '');

    expect(httpGet).not.toHaveBeenCalledWith(
      jasmine.stringMatching(/exchange\/configuration/),
      jasmine.anything()
    );
    expect(setExchangeConfiguration).not.toHaveBeenCalled();
  });

  it('requests the configuration only once', async () => {
    await run({enabled: true, url: 'https://exchange.example'});

    const calls = httpGet.calls
      .allArgs()
      .filter(([url]) => (url as string).endsWith('v1/exchange/configuration'));
    expect(calls.length).toBe(1);
  });
});
