/*
 * Copyright 2015-2024 Ritense BV, the Netherlands.
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

import {NGXLogger} from 'ngx-logger';
import {ConfigService} from '@valtimo/config';
import {CSP_HTTP_EQUIV, CSP_META_ID} from '../constants';
import {DomSanitizer} from '@angular/platform-browser';
import {CSPHeaderParams, getCSP} from 'csp-header';
import {SecurityContext} from '@angular/core';

const getSanitizedCspString = (
  cspHeaderParams: CSPHeaderParams,
  domSanitizer: DomSanitizer
): string => {
  const csp = getCSP(cspHeaderParams);
  return domSanitizer.sanitize(SecurityContext.HTML, csp);
};

const getCspHeaderElement = (
  cspHeaderParams: CSPHeaderParams,
  domSanitizer: DomSanitizer,
  document: Document
): HTMLMetaElement => {
  const csp = getSanitizedCspString(cspHeaderParams, domSanitizer);
  const cspMeta = document.createElement('meta');

  cspMeta.httpEquiv = CSP_HTTP_EQUIV;
  cspMeta.content = csp;
  cspMeta.id = CSP_META_ID;

  return cspMeta;
};

const appendElementToHead = (element: HTMLMetaElement, document: Document): void => {
  document.head.appendChild(element);
};

const isElementLoaded = async (elementId: string, document: Document): Promise<boolean> => {
  while (document.getElementById(elementId) === null) {
    await new Promise(resolve => requestAnimationFrame(resolve));
  }
  return !!document.getElementById(elementId);
};

export const initializeCsp =
  (
    logger: NGXLogger,
    configService: ConfigService,
    document: Document,
    domSanitizer: DomSanitizer
  ): (() => Promise<boolean>) =>
  async (): Promise<boolean> => {
    const cspHeaderParams = configService?.config?.csp;

    if (cspHeaderParams) {
      logger.log('Create CSP header element from:', cspHeaderParams);

      const cspHeaderElement = getCspHeaderElement(cspHeaderParams, domSanitizer, document);

      appendElementToHead(cspHeaderElement, document);

      return await isElementLoaded(CSP_META_ID, document);
    }

    logger.log('No CSP config present.');

    return true;
  };
