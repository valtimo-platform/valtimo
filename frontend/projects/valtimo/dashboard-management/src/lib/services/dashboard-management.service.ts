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

import {HttpClient} from '@angular/common/http';
import {Injectable} from '@angular/core';
import {ConfigService} from '@valtimo/config';
import {BehaviorSubject, catchError, Observable, of, switchMap, take} from 'rxjs';
import {DashboardItem} from '../models';

@Injectable({
  providedIn: 'root',
})
export class DashboardManagementService {
  private valtimoEndpointUri: string;

  public dashboards$: BehaviorSubject<DashboardItem[]> = new BehaviorSubject<DashboardItem[]>([]);

  public loadData(): void {
    this.http
      .get<DashboardItem[]>(this.valtimoEndpointUri)
      .pipe(take(1))
      .subscribe({
        next: (items: DashboardItem[]) => {
          this.dashboards$.next(items);
        },
        error: error => {
          console.error(error);
        },
      });
  }

  constructor(private readonly http: HttpClient, private readonly configService: ConfigService) {
    this.valtimoEndpointUri = `${this.configService.config.valtimoApi.endpointUri}management/v1/dashboard`;
  }

  public createDashboard(dashboard: DashboardItem): Observable<DashboardItem> {
    return this.http.post<DashboardItem>(this.valtimoEndpointUri, dashboard);
  }

  public deleteDashboard(dashboardKey: string): Observable<null> {
    return this.http.delete<null>(`${this.valtimoEndpointUri}/${dashboardKey}`);
  }

  public dispatchAction(actionResult: Observable<DashboardItem | null>): void {
    actionResult
      .pipe(
        switchMap(() => this.getDashboards()),
        take(1),
        catchError(error => of(error))
      )
      .subscribe({
        next: (items: DashboardItem[]) => this.dashboards$.next(items),
        error: error => {
          console.error(error);
        },
      });
  }

  private getDashboards(): Observable<DashboardItem[]> {
    return this.http.get<DashboardItem[]>(this.valtimoEndpointUri);
  }
}
