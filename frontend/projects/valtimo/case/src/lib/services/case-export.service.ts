import {HttpClient, HttpHeaders} from '@angular/common/http';
import {Injectable} from '@angular/core';
import {
  combineLatest,
  first,
  of,
  switchMap,
  startWith,
  Observable,
  catchError,
  fromEvent,
  map,
} from 'rxjs';
import {CaseListService} from './case-list.service';
import {CaseParameterService} from './case-parameter.service';
import {CaseListSearchService} from './case-list-search.service';
import {GlobalNotificationService, InterceptorSkip} from '@valtimo/shared';

@Injectable()
export class CaseExportService {
  constructor(
    private readonly http: HttpClient,
    private readonly listService: CaseListService,
    private readonly parameterService: CaseParameterService,
    private readonly caseListSearchService: CaseListSearchService,
    private readonly globalNotificationService: GlobalNotificationService
  ) {}

  public downloadExport(): Observable<{isLoading: boolean}> {
    return combineLatest([
      this.listService.caseDefinitionKey$,
      this.parameterService.querySearchParams$,
      this.parameterService.queryAssigneeParam$,
      this.parameterService.queryStatusParams$,
      this.parameterService.queryCaseTagsParams$,
    ]).pipe(
      first(),
      switchMap(data => {
        const body = {
          documentDefinitionName: data[0],
          searchOperator: 'AND',
          assigneeFilter: data[2],
          statusFilter: data[3],
          caseTagsFilter: data[4],
          otherFilters: this.caseListSearchService.mapSearchValuesToFilters(data[1]),
        };
        return this.http.post(
          `/api/v1/case/${data[0]}/export?definitionName=${data[0]}&page=0&size=10&sort=createdOn%2CDESC`,
          body,
          {
            responseType: 'blob',
            observe: 'response',
            headers: new HttpHeaders().set(InterceptorSkip, '400'),
          }
        );
      }),
      switchMap(data => {
        const contentDisposition = data.headers.get('Content-Disposition');
        let filename = 'export.csv';
        if (contentDisposition) {
          const matches = /filename="?([^"]+)"?/.exec(contentDisposition);
          if (matches != null && matches[1]) {
            filename = matches[1];
          }
        }
        const url = URL.createObjectURL(data.body as Blob);
        const link = document.createElement('a');
        link.href = url;
        link.target = '_blank';
        link.download = filename;
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
        return of({isLoading: false});
      }),
      catchError(error => {
        return this.readBlobAsText(error.error).pipe(
          switchMap(errorBlobData => {
            this.globalNotificationService.showToast({
              title: 'An unexpected error occurred',
              caption: errorBlobData?.title,
              type: 'error',
            });

            return of({isLoading: false, error: errorBlobData?.title});
          })
        );
      }),
      startWith({isLoading: true})
    );
  }

  private readBlobAsText(blob: Blob): Observable<any> {
    const reader = new FileReader();
    reader.readAsText(blob);
    return fromEvent(reader, 'load').pipe(map(() => JSON.parse(reader.result as string)));
  }
}
