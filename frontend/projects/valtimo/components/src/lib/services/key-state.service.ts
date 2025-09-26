import {Injectable, OnDestroy} from '@angular/core';
import {fromEvent, merge, Observable, Subject} from 'rxjs';
import {map, takeUntil} from 'rxjs/operators';

@Injectable({
  providedIn: 'root',
})
export class KeyStateService implements OnDestroy {
  private _isCtrlOrCmdPressed: boolean = false;
  private _destroy$ = new Subject<void>();

  constructor() {
    const keyDowns$: Observable<boolean> = fromEvent<KeyboardEvent>(document, 'keydown').pipe(
      map(event => event.ctrlKey || event.metaKey)
    );

    const keyUps$: Observable<boolean> = fromEvent<KeyboardEvent>(document, 'keyup').pipe(
      map(() => false)
    );

    merge(keyDowns$, keyUps$)
      .pipe(takeUntil(this._destroy$))
      .subscribe(isPressed => {
        this._isCtrlOrCmdPressed = isPressed;
      });
  }

  public getCtrlOrCmdState(): boolean {
    return this._isCtrlOrCmdPressed;
  }

  public ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
  }
}
