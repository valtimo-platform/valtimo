import {Injectable} from '@angular/core';
import {BehaviorSubject, Observable, filter} from 'rxjs';
import {DocumentDefinitionVersion} from '../models';
import {FINAL_VERSIONS} from '../mocks';
import {DRAFT_VERSIONS} from '../mocks/document-definition-draft-versions.mock';

@Injectable({
  providedIn: 'root',
})
export class DossierVersionApiService {
  private readonly _draftVersions$ = new BehaviorSubject<DocumentDefinitionVersion[]>(
    DRAFT_VERSIONS
  );
  public readonly draftVersions$: Observable<DocumentDefinitionVersion[]> =
    this._draftVersions$.pipe(filter(versions => !!versions));

  private readonly _finalVersions$ = new BehaviorSubject<DocumentDefinitionVersion[]>(
    FINAL_VERSIONS
  );
  public readonly finalVersions$: Observable<DocumentDefinitionVersion[]> =
    this._finalVersions$.pipe(filter(versions => !!versions));

  public finalizeVersion(version: DocumentDefinitionVersion): void {
    this._finalVersions$.next([...this._finalVersions$.getValue(), {...version, type: 'final'}]);
    this._draftVersions$.next(
      this._draftVersions$
        .getValue()
        .filter((draftVersion: DocumentDefinitionVersion) => draftVersion.id !== version.id)
    );
  }

  public saveDraft(version: DocumentDefinitionVersion): void {
    this._draftVersions$.next([...this._draftVersions$.getValue(), version]);
  }
}
