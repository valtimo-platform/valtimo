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
import {AccessControlService} from './access-control.service';
import {ExportRoleOutput, RoleExport} from '../models';
import {catchError, combineLatest, map, Observable, of, tap} from 'rxjs';

@Injectable({providedIn: 'root'})
export class AccessControlExportService {
  constructor(private readonly accessControlService: AccessControlService) {}

  public exportRoles(event: ExportRoleOutput): Observable<boolean> {
    return (
      event.type === 'unified'
        ? this.accessControlService.exportRolePermissions(event.roleKeys).pipe(
            tap(res => {
              this.downloadJson(res, event.type);
            })
          )
        : combineLatest(
            event.roleKeys.map((roleKey: string) =>
              this.accessControlService.exportRolePermissions([roleKey])
            )
          ).pipe(
            tap(res => {
              res.forEach((permissions, index) => {
                const roleKey = event.roleKeys[index];
                this.downloadJson(permissions, event.type, roleKey);
              });
            })
          )
    ).pipe(
      map(() => true),
      catchError(() => of(false))
    );
  }

  private downloadJson(permissions: Array<object>, type: RoleExport, roleKey?: string): void {
    const sJson = JSON.stringify({permissions}, null, 2);
    const element = document.createElement('a');
    element.setAttribute('href', 'data:text/json;charset=UTF-8,' + encodeURIComponent(sJson));
    element.setAttribute(
      'download',
      `${type === 'separate' ? roleKey : 'combined'}.permission.json`
    );
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click(); // simulate click
    document.body.removeChild(element);
  }
}
