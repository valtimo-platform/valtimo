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

import {HttpClient} from '@angular/common/http';
import {Injectable} from '@angular/core';
import {ConfigService, InterceptorSkipHeader, PbacRegistryDto} from '@valtimo/shared';
import {BehaviorSubject, catchError, Observable, of, switchMap, take, tap} from 'rxjs';
import {DeleteRolesRequest, Permission, PermissionSchema, Role} from '../models';

@Injectable({providedIn: 'root'})
export class AccessControlService {
  public readonly roles$ = new BehaviorSubject<Role[]>([]);
  public readonly loading$ = new BehaviorSubject<boolean>(false);

  private valtimoEndpointUri: string;
  private readonly apiEndpointUri: string;

  private get roleDtos$(): Observable<Role[]> {
    return this.http.get<Role[]>(`${this.valtimoEndpointUri}v1/roles`);
  }

  constructor(
    private readonly configService: ConfigService,
    private readonly http: HttpClient
  ) {
    this.apiEndpointUri = this.configService.config.valtimoApi.endpointUri;
    this.valtimoEndpointUri = `${this.apiEndpointUri}management/`;
  }

  // The roles known to the identity provider (e.g. Keycloak realm roles), optionally filtered by a
  // name prefix. Used to let an admin pick an existing role when configuring access control instead
  // of typing its key by hand. Degrades to an empty list (and stays silent) when the endpoint is
  // unavailable — e.g. a deployment using a different IAM — so the caller can fall back to manual
  // entry.
  public getExternalRoles(externalRoleNamePrefix?: string): Observable<string[]> {
    const params = externalRoleNamePrefix
      ? `?externalRoleNamePrefix=${encodeURIComponent(externalRoleNamePrefix)}`
      : '';
    return this.http
      .get<string[]>(`${this.apiEndpointUri}v1/external-role${params}`, {
        headers: InterceptorSkipHeader,
      })
      .pipe(catchError(() => of([])));
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

  public getRolePermissions(roleKey: string): Observable<Permission[]> {
    return this.http.get<Permission[]>(`${this.valtimoEndpointUri}v1/roles/${roleKey}/permissions`);
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

  public getPermissionSchema(): Observable<PermissionSchema> {
    return this.http.get<PermissionSchema>(`${this.valtimoEndpointUri}v1/permissions/schema`);
  }

  public getPbacRegistry(): Observable<PbacRegistryDto> {
    return this.http.get<PbacRegistryDto>(`${this.valtimoEndpointUri}v1/pbac/registry`);
  }

  public updateRole(roleKey: string, request: Role): Observable<object> {
    return this.http.put<object>(`${this.valtimoEndpointUri}v1/roles/${roleKey}`, request);
  }
}
