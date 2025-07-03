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

import {
  AfterViewInit,
  ChangeDetectorRef,
  Directive,
  DoCheck,
  ElementRef,
  Input,
  OnDestroy,
} from '@angular/core';

@Directive({
  selector: '[removeClassnames]',
  standalone: true,
})
export class RemoveClassnamesDirective implements AfterViewInit, DoCheck, OnDestroy {
  private _observer!: MutationObserver;

  @Input() public removeClassnames: string[] = [];

  constructor(
    private readonly el: ElementRef,
    private readonly cdr: ChangeDetectorRef
  ) {}

  public ngAfterViewInit(): void {
    this.removeClasses();

    setTimeout(() => this.removeClasses());

    this._observer = new MutationObserver(() => {
      this.removeClasses();
      this.cdr.detectChanges();
    });

    this._observer.observe(this.el.nativeElement, {
      childList: true,
      subtree: true,
      attributes: true,
    });
  }

  public ngDoCheck(): void {
    this.removeClasses();
  }

  public ngOnDestroy(): void {
    this._observer?.disconnect();
  }

  private removeClasses(): void {
    const hostElement = this.el.nativeElement as HTMLElement;

    this.removeClassnames.forEach(className => {
      if (hostElement.classList.contains(className)) {
        hostElement.classList.remove(className);
      }

      const childElements = this.el.nativeElement.querySelectorAll(`.${className}`);

      childElements.forEach((element: HTMLElement) => {
        element.classList.remove(className);
      });
    });

    this.cdr.markForCheck();
  }
}
