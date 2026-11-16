/*
 * Copyright 2015-2025 Ritense BV, the Netherlands.
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

import {DomSanitizer} from '@angular/platform-browser';
import {ConfigService} from '@valtimo/shared';
import {NGXLogger} from 'ngx-logger';
import {CSP_META_ID} from '../constants';
import {initializeCsp} from './initialize-csp';

describe('initializeCsp', () => {
  const logger = jasmine.createSpyObj<NGXLogger>('NGXLogger', ['log']);
  const domSanitizer = {sanitize: (_context: unknown, value: string) => value} as DomSanitizer;

  const configWith = (directives: Record<string, string[]>): ConfigService =>
    ({config: {csp: {directives}}}) as unknown as ConfigService;

  const cspContent = (): string =>
    (document.getElementById(CSP_META_ID) as HTMLMetaElement).content;

  afterEach(() => document.getElementById(CSP_META_ID)?.remove());

  it('augments only the directives it is given origins for', async () => {
    const config = configWith({
      'frame-src': ["'self'"],
      'img-src': ["'self'"],
      'connect-src': ["'self'"],
    });

    await initializeCsp(logger, config, document, domSanitizer, {
      imgSrc: ['https://exchange.example'],
      connectSrc: ['https://exchange.example'],
    })();

    const directives = config.config.csp.directives as Record<string, string[]>;
    expect(directives['frame-src']).toEqual(["'self'"]);
    expect(directives['img-src']).toEqual(["'self'", 'https://exchange.example']);
    expect(directives['connect-src']).toEqual(["'self'", 'https://exchange.example']);
    expect(cspContent()).toContain('https://exchange.example');
  });

  it('augments all three directives when the same list is given for each', async () => {
    const config = configWith({'frame-src': [], 'img-src': [], 'connect-src': []});
    const origins = ['https://plugin-host.example'];

    await initializeCsp(logger, config, document, domSanitizer, {
      frameSrc: origins,
      imgSrc: origins,
      connectSrc: origins,
    })();

    const directives = config.config.csp.directives as Record<string, string[]>;
    expect(directives['frame-src']).toEqual(origins);
    expect(directives['img-src']).toEqual(origins);
    expect(directives['connect-src']).toEqual(origins);
  });

  it('does not add origins that are already present or duplicated', async () => {
    const config = configWith({'img-src': ['https://a.example']});

    await initializeCsp(logger, config, document, domSanitizer, {
      imgSrc: ['https://a.example', 'https://b.example', 'https://b.example'],
    })();

    expect((config.config.csp.directives as Record<string, string[]>)['img-src']).toEqual([
      'https://a.example',
      'https://b.example',
    ]);
  });

  it('does nothing without a csp config', async () => {
    const config = {config: {}} as unknown as ConfigService;

    expect(await initializeCsp(logger, config, document, domSanitizer)()).toBeTrue();
    expect(document.getElementById(CSP_META_ID)).toBeNull();
  });
});
