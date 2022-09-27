import {Injectable} from '@angular/core';
import {BehaviorSubject, Observable, Subject} from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class ValtimoModalService {
  private readonly _scrollToTop$ = new Subject<null>();
  private readonly _documentDefinitionName$ = new BehaviorSubject<string>('');

  get scrollToTop$(): Observable<null> {
    return this._scrollToTop$.asObservable();
  }

  get documentDefinitionName$(): Observable<string> {
    return this._documentDefinitionName$.asObservable();
  }

  scrollToTop(): void {
    this._scrollToTop$.next(null);
  }

  setDocumentDefinitionName(documentDefinitionName: string): void {
    this._documentDefinitionName$.next(documentDefinitionName);
  }
}
