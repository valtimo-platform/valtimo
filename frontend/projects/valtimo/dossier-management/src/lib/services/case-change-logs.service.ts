import {Injectable} from '@angular/core';
import {NamedUser} from '@valtimo/config';
import {of, map, Observable, BehaviorSubject, startWith, debounceTime} from 'rxjs';
import {COLLABORATORS} from '../mocks';
import {CaseChangeLog, Collaborator} from '../models';
import {CASE_CHANGE_LOGS} from '../mocks';

@Injectable({
  providedIn: 'root',
})
export class CaseChangeLogsService {
  private readonly _caseChangeLogs$ = new BehaviorSubject<CaseChangeLog[]>(CASE_CHANGE_LOGS);

  public readonly activeLogSearch$ = new BehaviorSubject<string | null>(null);

  public readonly caseChangeLogs$: Observable<CaseChangeLog[] | null> = this._caseChangeLogs$.pipe(
    debounceTime(1000),
    startWith(null)
  );
}
