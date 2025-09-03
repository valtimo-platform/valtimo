import {Injectable, Signal, computed, signal} from '@angular/core';
import {BehaviorSubject, Observable, filter, tap} from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class QuickSearchStateService {
  private readonly _$modalOpen = signal<boolean>(false);
  public get $modalOpen(): Signal<boolean> {
    return computed(() => this._$modalOpen());
  }

  private readonly _paramsToSave$ = new BehaviorSubject<{[key: string]: string} | null>(null);
  public readonly paramsToSave$ = this._paramsToSave$.pipe(filter(params => !!params));

  public openModal(params?: {[key: string]: string}): void {
    this._paramsToSave$.next(params);
    this._$modalOpen.set(true);
  }

  public closeModal(): void {
    this._paramsToSave$.next(null);
    this._$modalOpen.set(false);
  }
}
