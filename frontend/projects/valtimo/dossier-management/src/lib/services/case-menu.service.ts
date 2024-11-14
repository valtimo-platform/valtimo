import {Injectable} from '@angular/core';
import {BehaviorSubject, Observable, map} from 'rxjs';
import {TabEnum} from '../models';

@Injectable({
  providedIn: 'root',
})
export class CaseMenuService {
  private readonly _activeMenuItem$ = new BehaviorSubject<string | TabEnum | null>(null);

  public isItemSelected$: Observable<boolean> = this._activeMenuItem$.pipe(
    map((menuItem: string | TabEnum | null) => !!menuItem)
  );

  public selectMenuItem(value: string | TabEnum | null): void {
    this._activeMenuItem$.next(value);
  }
}
