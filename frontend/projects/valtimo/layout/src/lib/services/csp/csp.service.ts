/*
 * Copyright 2015-2023 Ritense BV, the Netherlands.
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

import {Inject, Injectable, SecurityContext} from '@angular/core';
import {DOCUMENT} from '@angular/common';
import {CSPHeaderParams, getCSP} from 'csp-header';
import {DomSanitizer} from '@angular/platform-browser';
import {map, Observable, of} from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class CspService {
  constructor(
    @Inject(DOCUMENT) private readonly document: Document,
    private readonly domSanitizer: DomSanitizer
  ) {}

  public registerCsp(cspHeaderParams: CSPHeaderParams): Observable<boolean> {
    return of(false).pipe(
      map(() => {
        const csp = getCSP(cspHeaderParams);
        const sanitizedCsp = this.domSanitizer.sanitize(SecurityContext.HTML, csp);
        const cspMeta = this.document.createElement('meta');
        const cspMetaId = 'CSP_META';

        cspMeta.httpEquiv = 'Content-Security-Policy';
        cspMeta.content = sanitizedCsp;
        cspMeta.id = cspMetaId;

        this.document.head.appendChild(cspMeta);

        return !!this.document.getElementById(cspMetaId);
      })
    );
  }
}
