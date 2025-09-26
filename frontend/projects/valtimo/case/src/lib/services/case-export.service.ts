import {HttpClient} from '@angular/common/http';
import {Injectable} from '@angular/core';
import {Observable, of} from 'rxjs';

@Injectable()
export class CaseExportService {
  constructor(private http: HttpClient) {}

  downloadExport(): Observable<any> {
    // TODO make http call to download the export file
    return of([]);
  }
}
