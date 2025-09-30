import {HttpClient} from '@angular/common/http';
import {Injectable} from '@angular/core';
import {BaseApiService, CaseManagementParams, ConfigService} from '@valtimo/shared';
import {BasicWidget, IWidgetManagementService} from '@valtimo/layout';
import {BehaviorSubject, catchError, filter, map, Observable, of, switchMap} from 'rxjs';
import {isEqual} from 'lodash';

@Injectable()
export class CaseHeaderWidgetManagementService
  extends BaseApiService
  implements IWidgetManagementService<CaseManagementParams>
{
  private readonly _params$ = new BehaviorSubject<CaseManagementParams | null>(null);
  public readonly params$: Observable<CaseManagementParams | null> = this._params$.asObservable();
  private readonly paramsRequired$ = this._params$.pipe(
    filter((p): p is CaseManagementParams => !!p)
  );
  public readonly valueResolverApi$ = new BehaviorSubject<string | null>('');

  constructor(
    protected override httpClient: HttpClient,
    protected override configService: ConfigService
  ) {
    super(httpClient, configService);
  }

  public initParams(...params: any[]): void {
    const serviceParams = params[0] as CaseManagementParams;
    if (!isEqual(serviceParams, this._params$.getValue())) {
      this._params$.next(serviceParams);
    }
  }

  public getWidgetConfiguration(): Observable<BasicWidget[]> {
    return this.paramsRequired$.pipe(
      switchMap(({caseDefinitionKey, caseDefinitionVersionTag}) =>
        this.httpClient
          .get<BasicWidget>(
            this.getApiUrl(
              `management/v1/case-definition/${encodeURIComponent(
                caseDefinitionKey
              )}/version/${encodeURIComponent(caseDefinitionVersionTag)}/header-widget`
            )
          )
          .pipe(
            map(widget => [widget].filter(Boolean)),
            catchError(err => {
              if (err?.status === 404) return of([] as BasicWidget[]);
              throw err;
            })
          )
      )
    );
  }

  public updateWidgetConfiguration(widgets: BasicWidget[]): Observable<BasicWidget[]> {
    const widget = widgets[0];
    return this.paramsRequired$.pipe(
      switchMap(({caseDefinitionKey, caseDefinitionVersionTag}) =>
        this.httpClient.put<BasicWidget>(
          this.getApiUrl(
            `management/v1/case-definition/${encodeURIComponent(
              caseDefinitionKey
            )}/version/${encodeURIComponent(caseDefinitionVersionTag)}/header-widget`
          ),
          widget
        )
      ),
      map(updated => [updated].filter(Boolean))
    );
  }

  public deleteWidget(_: BasicWidget): Observable<void> {
    return this.paramsRequired$.pipe(
      switchMap(({caseDefinitionKey, caseDefinitionVersionTag}) =>
        this.httpClient.delete<void>(
          this.getApiUrl(
            `management/v1/case-definition/${encodeURIComponent(
              caseDefinitionKey
            )}/version/${encodeURIComponent(caseDefinitionVersionTag)}/header-widget`
          )
        )
      )
    );
  }

  public updateWidget(widget: BasicWidget): Observable<BasicWidget> {
    return this.paramsRequired$.pipe(
      switchMap(({caseDefinitionKey, caseDefinitionVersionTag}) =>
        this.httpClient.put<BasicWidget>(
          this.getApiUrl(
            `management/v1/case-definition/${encodeURIComponent(
              caseDefinitionKey
            )}/version/${encodeURIComponent(caseDefinitionVersionTag)}/header-widget`
          ),
          widget
        )
      )
    );
  }

  public createWidget(widget: BasicWidget): Observable<BasicWidget> {
    return this.paramsRequired$.pipe(
      switchMap(({caseDefinitionKey, caseDefinitionVersionTag}) =>
        this.httpClient.post<BasicWidget>(
          this.getApiUrl(
            `management/v1/case-definition/${encodeURIComponent(
              caseDefinitionKey
            )}/version/${encodeURIComponent(caseDefinitionVersionTag)}/header-widget`
          ),
          widget
        )
      )
    );
  }
}
