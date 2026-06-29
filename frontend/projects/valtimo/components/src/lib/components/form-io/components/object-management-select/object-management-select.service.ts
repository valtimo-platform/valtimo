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

import {Injectable} from '@angular/core';
import {HttpClient, HttpParams} from '@angular/common/http';
import {Observable} from 'rxjs';
import {ObjectsPage} from './object-management-select.model';

@Injectable({providedIn: 'root'})
export class ObjectManagementSelectService {
  private readonly _API_URL = '/api/v1/object-management/objects';

  constructor(private readonly _http: HttpClient) {}

  getObjects(params: {
    id?: string;
    title?: string;
    dataAttrs?: string;
    page?: number;
    size?: number;
    sort?: string;
  }): Observable<ObjectsPage> {
    let httpParams = new HttpParams()
      .set('page', (params.page ?? 0).toString())
      .set('size', (params.size ?? 20).toString());

    if (params.id) {
      httpParams = httpParams.set('id', params.id);
    }
    if (params.title) {
      httpParams = httpParams.set('title', params.title);
    }
    if (params.dataAttrs) {
      httpParams = httpParams.set('dataAttrs', params.dataAttrs);
    }
    if (params.sort) {
      httpParams = httpParams.set('sort', params.sort);
    }

    return this._http.get<ObjectsPage>(this._API_URL, {params: httpParams});
  }
}
