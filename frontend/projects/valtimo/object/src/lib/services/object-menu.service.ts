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

import {Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Observable} from 'rxjs';
import {map} from 'rxjs/operators';
import {ConfigService, MenuItem} from '@valtimo/shared';

@Injectable({providedIn: 'root'})
export class ObjectMenuService {
  constructor(
    private readonly http: HttpClient,
    private readonly configService: ConfigService
  ) {}

  public appendObjectMenuItems = (menuItems: MenuItem[]): Observable<MenuItem[]> => {
    const apiBaseUrl = this.configService.config.valtimoApi.endpointUri;

    return this.getObjects(apiBaseUrl).pipe(
      map(objects => {
        const visibleObjects = objects.filter(obj => obj?.showInDataMenu !== false);

        const objectItems: MenuItem[] = visibleObjects.map((obj, index) => ({
          link: ['/objects/' + obj.id],
          title: obj.title,
          iconClass: 'icon mdi mdi-dot-circle',
          sequence: index,
          show: true,
        }));

        const index = menuItems.findIndex(item => item.title === 'Objects');

        if (index >= 0) {
          menuItems[index].children = objectItems;
        }

        return menuItems;
      })
    );
  };

  private getObjects(apiBaseUrl: string): Observable<any[]> {
    const url = `${apiBaseUrl}v1/object/management/configuration`;
    return this.http.get<any[]>(url);
  }
}
