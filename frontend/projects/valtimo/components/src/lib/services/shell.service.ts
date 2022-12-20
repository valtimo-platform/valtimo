import {Injectable} from '@angular/core';
import {BehaviorSubject, Observable} from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class ShellService {
  private readonly _sideBarExpanded$ = new BehaviorSubject<boolean>(true);
  private readonly _panelExpanded$ = new BehaviorSubject<boolean>(false);
  private readonly _largeScreen$ = new BehaviorSubject<boolean>(true);
  private readonly _mouseOnTopBar$ = new BehaviorSubject<boolean>(false);

  get sideBarExpanded$(): Observable<boolean> {
    return this._sideBarExpanded$.asObservable();
  }
  get panelExpanded$(): Observable<boolean> {
    return this._panelExpanded$.asObservable();
  }
  get largeScreen$(): Observable<boolean> {
    return this._largeScreen$.asObservable();
  }
  get mouseOnTopBar$(): Observable<boolean> {
    return this._mouseOnTopBar$.asObservable();
  }

  toggleSideBar(): void {
    const isExpanded = this._sideBarExpanded$.getValue();
    this._sideBarExpanded$.next(!isExpanded);
  }

  togglePanel(): void {
    const isExpanded = this._panelExpanded$.getValue();
    this._panelExpanded$.next(!isExpanded);
  }

  setPanelExpanded(isExpanded: boolean): void {
    this._panelExpanded$.next(isExpanded);
  }

  setSideBarExpanded(isExpanded: boolean): void {
    this._sideBarExpanded$.next(isExpanded);
  }

  setLargeScreen(isLarge: boolean): void {
    this._largeScreen$.next(isLarge);
  }

  setMouseOnTopBar(mouseOnTopBar: boolean): void {
    this._mouseOnTopBar$.next(mouseOnTopBar);
  }
}
