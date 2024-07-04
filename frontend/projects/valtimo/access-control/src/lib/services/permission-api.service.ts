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

import {HttpClient} from '@angular/common/http';
import {Injectable} from '@angular/core';
import {ConfigService} from '@valtimo/config';
import {map, Observable} from 'rxjs';
import {
  PermissionRequest,
  PermissionRequestQueue,
  PermissionResponse,
  ResolvedPermissions,
} from '../models';
import {getPermissionRequestKey} from '../utils';
import {NGXLogger} from 'ngx-logger';

@Injectable({
  providedIn: 'root',
})
export class PermissionApiService {
  private valtimoEndpointUri: string;

  constructor(
    private readonly http: HttpClient,
    private readonly configService: ConfigService,
    private readonly logger: NGXLogger
  ) {
    this.valtimoEndpointUri = this.configService.config.valtimoApi.endpointUri;
  }

  public resolvePermissionRequestQueue(
    permissionRequestQueue: PermissionRequestQueue
  ): Observable<ResolvedPermissions> {
    this.logger.debug('Permissions: request to resolve permission queue', permissionRequestQueue);

    return this.requestPermission(permissionRequestQueue).pipe(
      map((res: PermissionResponse[]) => {
        const keys: string[] = permissionRequestQueue.map(permissionRequest =>
          getPermissionRequestKey(permissionRequest)
        );

        return res.reduce(
          (acc: ResolvedPermissions, curr: PermissionResponse, index: number) => ({
            ...acc,
            [keys[index]]: curr.available,
          }),
          {}
        );
      })
    );
  }

  public requestPermission(request: PermissionRequest[]): Observable<PermissionResponse[]> {
    return this.http.post<PermissionResponse[]>(
      `${this.valtimoEndpointUri}v1/permissions`,
      request
    );
  }
}
