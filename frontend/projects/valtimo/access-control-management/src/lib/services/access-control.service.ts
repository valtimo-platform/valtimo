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
import {BehaviorSubject, catchError, Observable, of, switchMap, take, tap} from 'rxjs';
import {DeleteRolesRequest, Role} from '../models';

@Injectable({providedIn: 'root'})
export class AccessControlService {
  public readonly roles$ = new BehaviorSubject<Role[]>([]);
  public readonly loading$ = new BehaviorSubject<boolean>(false);

  private valtimoEndpointUri: string;

  private get roleDtos$(): Observable<Role[]> {
    return this.http.get<Role[]>(`${this.valtimoEndpointUri}v1/roles`);
  }

  constructor(
    private readonly configService: ConfigService,
    private readonly http: HttpClient
  ) {
    this.valtimoEndpointUri = `${this.configService.config.valtimoApi.endpointUri}management/`;
  }

  public addRole(role: Role): Observable<Role> {
    return this.http.post<Role>(`${this.valtimoEndpointUri}v1/roles`, role);
  }

  public deleteRoles(request: DeleteRolesRequest): Observable<null> {
    return this.http.delete<null>(`${this.valtimoEndpointUri}v1/roles`, {body: request});
  }

  public dispatchAction(actionResult: Observable<Role | null>): void {
    actionResult
      .pipe(
        tap(() => {
          this.loading$.next(true);
        }),
        switchMap(() => this.roleDtos$),
        take(1),
        catchError(error => of(error))
      )
      .subscribe({
        next: (roles: Role[]) => {
          this.roles$.next(roles);
          this.loading$.next(false);
        },
        error: error => {
          console.error(error);
        },
      });
  }

  public loadRoles(): void {
    this.roleDtos$
      .pipe(
        tap(() => {
          this.loading$.next(true);
        }),
        take(1)
      )
      .subscribe({
        next: (items: Role[]) => {
          this.roles$.next(items);
          this.loading$.next(false);
        },
        error: error => {
          console.error(error);
        },
      });
  }

  public getRolePermissions(roleKey: string): Observable<Array<object>> {
    return this.http.get<Array<object>>(
      `${this.valtimoEndpointUri}v1/roles/${roleKey}/permissions`
    );
  }

  public exportRolePermissions(roles: string[]): Observable<object[]> {
    return this.http.post<object[]>(`${this.valtimoEndpointUri}v1/permissions/search`, {roles});
  }

  public updateRolePermissions(roleKey: string, updatedPermission: object): Observable<object> {
    return this.http.put<object>(
      `${this.valtimoEndpointUri}v1/roles/${roleKey}/permissions`,
      updatedPermission
    );
  }

  public updateRole(roleKey: string, request: Role): Observable<object> {
    return this.http.put<object>(`${this.valtimoEndpointUri}v1/roles/${roleKey}`, request);
  }
}
