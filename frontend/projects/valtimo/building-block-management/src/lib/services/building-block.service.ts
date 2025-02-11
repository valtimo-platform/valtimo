import {Injectable} from '@angular/core';
import {BehaviorSubject, Observable} from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class BuildingBlockService {
  private readonly _backButtonActive$ = new BehaviorSubject<boolean>(false);
  public get backButtonActive$(): Observable<boolean> {
    return this._backButtonActive$.asObservable();
  }

  public backButtonClick(): void {
    this._backButtonActive$.next(false);
  }

  public viewChanged(): void {
    this._backButtonActive$.next(true);
  }
}
