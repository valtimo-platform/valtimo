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

import {Injectable} from '@angular/core';
import {BehaviorSubject, Observable, Subject} from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class ValtimoModalService {
  private readonly _scrollToTop$ = new Subject<null>();
  private readonly _documentDefinitionName$ = new BehaviorSubject<string>('');

  get scrollToTop$(): Observable<null> {
    return this._scrollToTop$.asObservable();
  }

  get documentDefinitionName$(): Observable<string> {
    return this._documentDefinitionName$.asObservable();
  }

  scrollToTop(): void {
    this._scrollToTop$.next(null);
  }

  setDocumentDefinitionName(documentDefinitionName: string): void {
    this._documentDefinitionName$.next(documentDefinitionName);
  }
}
