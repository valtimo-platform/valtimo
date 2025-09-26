/*
 * Copyright 2015-2025 Ritense BV, the Netherlands.
 *
 * Licensed under EUPL, Version 1.2 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * https://joinup.ec.europa.eu/collection/eupl/eupl-text-eupl-12
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import {AfterViewInit, Directive, ElementRef, HostBinding, Input, OnDestroy} from '@angular/core';
import {BehaviorSubject, Subscription} from 'rxjs';

@Directive({selector: '[valtimoReadOnly]', standalone: true})
export class ReadOnlyDirective implements AfterViewInit, OnDestroy {
  private readonly _isReadOnly$ = new BehaviorSubject<boolean>(true);
  @Input() public set isReadOnly(value: boolean) {
    this._isReadOnly$.next(value);
  }
  @HostBinding('class') public readonly class = 'valtimo-read-only';

  private readonly _subscriptions = new Subscription();

  constructor(private readonly elementRef: ElementRef) {}

  public ngAfterViewInit(): void {
    this._subscriptions.add(
      this._isReadOnly$.subscribe((readonly: boolean) => {
        if (readonly) this.elementRef.nativeElement.classList.add(this.class);
        else this.elementRef.nativeElement.classList.remove(this.class);
      })
    );
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }
}
