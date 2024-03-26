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
import {BehaviorSubject, Observable} from 'rxjs';
import {FormioComponent} from '@formio/angular';

@Injectable({
  providedIn: 'root',
})
export class FormIoStateService {
  private _documentDefinitionName$ = new BehaviorSubject<string>(undefined);
  private _documentId$ = new BehaviorSubject<string>(undefined);

  private _currentForm$ = new BehaviorSubject<FormioComponent>(undefined);

  public get documentDefinitionName$(): Observable<string> {
    return this._documentDefinitionName$.asObservable();
  }

  public setDocumentDefinitionName(documentDefinitionName: string) {
    this._documentDefinitionName$.next(documentDefinitionName);
  }

  public get documentId$(): Observable<string> {
    return this._documentId$.asObservable();
  }

  public setDocumentId(documentId: string) {
    this._documentId$.next(documentId);
  }

  public get currentForm$(): Observable<FormioComponent> {
    return this._currentForm$.asObservable();
  }

  public set currentForm(form: FormioComponent) {
    this._currentForm$.next(form);
  }

  flattenTranslationsObject(translations) {
    const stack = [{prefix: '', value: translations}];
    const flattened = {};

    while (stack.length > 0) {
      const {prefix, value} = stack.pop();

      Object.entries(value).forEach(([key, currentValue]) => {
        const currentPrefix = prefix + key + '.';

        if (typeof currentValue === 'object' && currentValue !== null) {
          stack.push({prefix: currentPrefix, value: currentValue});
        } else {
          flattened[currentPrefix.slice(0, -1)] = currentValue;
        }
      });
    }

    return flattened;
  }
}
