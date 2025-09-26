import {HttpClient, HttpHeaders} from '@angular/common/http';
import {Injectable} from '@angular/core';
import {
  catchError,
  combineLatest,
  first,
  fromEvent,
  map,
  Observable,
  of,
  startWith,
  switchMap,
} from 'rxjs';
import {DossierListService} from './dossier-list.service';
import {DossierParameterService} from './dossier-parameter.service';
import {DossierListSearchService} from './dossier-list-search.service';
import {InterceptorSkip} from '@valtimo/security';
import {ToastrService} from 'ngx-toastr';
import {CASES_WITHOUT_STATUS_KEY} from '@valtimo/components';

@Injectable()
export class CaseExportService {
  constructor(
    private readonly http: HttpClient,
    private readonly listService: DossierListService,
    private readonly parameterService: DossierParameterService,
    private readonly caseListSearchService: DossierListSearchService,
    private readonly toasterService: ToastrService
  ) {}

  public downloadExport(): Observable<{isLoading: boolean}> {
    return combineLatest([
      this.listService.documentDefinitionName$,
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
          statusFilter: data[3].map((statusKey: string) =>
            statusKey === CASES_WITHOUT_STATUS_KEY ? null : statusKey
          ),
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
            this.toasterService.warning(`${errorBlobData?.title}`, `An unexpected error occurred`, {
              enableHtml: true,
              tapToDismiss: false,
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
