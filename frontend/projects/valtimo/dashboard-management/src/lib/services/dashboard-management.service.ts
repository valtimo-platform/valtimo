import {HttpClient} from '@angular/common/http';
import {Injectable} from '@angular/core';
import {ConfigService} from '@valtimo/config';
import {BehaviorSubject, catchError, Observable, of, switchMap, take, tap} from 'rxjs';
import {DashboardItem} from '../models';

@Injectable({
  providedIn: 'root',
})
export class DashboardManagementService {
  private valtimoEndpointUri: string;

  public dashboards$ = new BehaviorSubject<{items: DashboardItem[] | null; loading: boolean}>({
    items: null,
    loading: true,
  });

  public loadData(): void {
    this.http
      .get<DashboardItem[]>(this.valtimoEndpointUri)
      .pipe(
        take(1),
        tap(() => {
          this.dashboards$.next({items: null, loading: true});
        })
      )
      .subscribe({
        next: (items: DashboardItem[]) => {
          this.dashboards$.next({items, loading: false});
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
        tap(() => {
          this.dashboards$.next({items: null, loading: true});
        }),
        take(1),
        catchError(error => of(error))
      )
      .subscribe({
        next: (items: DashboardItem[]) => this.dashboards$.next({items, loading: false}),
        error: error => {
          console.error(error);
        },
      });
  }

  private getDashboards(): Observable<DashboardItem[]> {
    return this.http.get<DashboardItem[]>(this.valtimoEndpointUri);
  }
}
