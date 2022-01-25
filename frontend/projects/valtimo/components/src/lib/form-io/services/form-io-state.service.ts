import {Injectable} from '@angular/core';
import {BehaviorSubject, Observable} from 'rxjs';
import {FormioComponent} from 'angular-formio';

@Injectable()
export class FormIoStateService {
  private _documentDefinitionName$ = new BehaviorSubject<string>(undefined);

  private _currentForm$ = new BehaviorSubject<FormioComponent>(undefined);

  public get documentDefinitionName$(): Observable<string> {
    return this._documentDefinitionName$.asObservable();
  }

  public setDocumentDefinitionName(documentDefinitionName: string) {
    this._documentDefinitionName$.next(documentDefinitionName);
  }

  public get currentForm$(): Observable<FormioComponent> {
    return this._currentForm$.asObservable();
  }

  public set currentForm(form: FormioComponent) {
    this._currentForm$.next(form);
  }
}
