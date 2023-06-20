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
    this.valtimoEndpointUri = `${this.configService.config.valtimoApi.endpointUri}v1/dashboard`;
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
