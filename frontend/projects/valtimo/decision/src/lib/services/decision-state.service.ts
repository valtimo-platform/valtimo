import {Injectable} from '@angular/core';
import {Observable, startWith, Subject} from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class DecisionStateService {
  private readonly _refreshDecisions$ = new Subject<null>();

  get refreshDecisions$(): Observable<null> {
    return this._refreshDecisions$.asObservable().pipe(startWith(null));
  }

  refreshDecisions(): void {
    this._refreshDecisions$.next(null);
  }
}
