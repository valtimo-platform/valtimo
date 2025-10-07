import {HttpClient} from '@angular/common/http';
import {Injectable} from '@angular/core';
import {IQuickSearchService, QuickSearchItem} from '@valtimo/components';
import {BaseApiService, ConfigService} from '@valtimo/shared';
import {BehaviorSubject, Observable, filter, of, switchMap, take, tap} from 'rxjs';
import {CaseListQuickSearchParams} from '../models';

@Injectable()
export class CaseListQuickSearchService
  extends BaseApiService
  implements IQuickSearchService<CaseListQuickSearchParams>
{
  private readonly _params$ = new BehaviorSubject<CaseListQuickSearchParams | null>(null);
  private get _params(): CaseListQuickSearchParams {
    return this._params$.getValue() ?? {caseDefinitionKey: ''};
  }
  public get params$(): Observable<CaseListQuickSearchParams | null> {
    return this._params$.pipe(filter(params => !!params));
  }

  constructor(
    protected readonly httpClient: HttpClient,
    protected readonly configService: ConfigService
  ) {
    super(httpClient, configService);
  }

  public initParams(caseDefinitionKey: string): void {
    if (caseDefinitionKey === this._params.caseDefinitionKey) return;
    this._params$.next({caseDefinitionKey});
  }

  public getQuickSearchItems(): Observable<QuickSearchItem[]> {
    return this.params$.pipe(
      take(1),
      switchMap((params: CaseListQuickSearchParams | null) =>
        this.httpClient.get<QuickSearchItem[]>(
          this.getApiUrl(`v1/case/${params?.caseDefinitionKey}/stored-quick-search`)
        )
      )
    );
  }

  public createQuickSearchItem(quickSearchItem: QuickSearchItem): Observable<QuickSearchItem> {
    return this.params$.pipe(
      take(1),
      switchMap((params: CaseListQuickSearchParams | null) =>
        this.httpClient.post<QuickSearchItem>(
          this.getApiUrl(`v1/case/${params?.caseDefinitionKey}/stored-quick-search`),
          quickSearchItem
        )
      )
    );
  }
  public updateQuickSearchItems(
    quickSearchItems: QuickSearchItem[]
  ): Observable<QuickSearchItem[]> {
    throw new Error('Method not implemented.');
  }

  public editQuickSearchItem(quickSearchItem: QuickSearchItem): Observable<QuickSearchItem> {
    return this.params$.pipe(
      take(1),
      switchMap((params: CaseListQuickSearchParams | null) =>
        this.httpClient.put<QuickSearchItem>(
          this.getApiUrl(`v1/case/${params?.caseDefinitionKey}/stored-quick-search`),
          quickSearchItem
        )
      )
    );
  }
  public deleteQuickSearchItem(quickSearchItem: QuickSearchItem): Observable<void> {
    return this.params$.pipe(
      take(1),
      switchMap((params: CaseListQuickSearchParams | null) =>
        this.httpClient.delete<void>(
          this.getApiUrl(
            `v1/case/${params?.caseDefinitionKey}/stored-quick-search/${quickSearchItem.title}`
          )
        )
      )
    );
  }
}
