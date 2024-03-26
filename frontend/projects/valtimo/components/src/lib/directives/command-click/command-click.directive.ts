/*
 * Copyright 2015-2024 Ritense BV, the Netherlands.
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
  Directive,
  ElementRef,
  EventEmitter,
  OnDestroy,
  OnInit,
  Output,
  Renderer2,
} from '@angular/core';

@Directive({
  selector: '[ctrl-click]',
})
export class CtrlClickDirective implements OnInit, OnDestroy {
  @Output('ctrl-click') ctrlClickEvent = new EventEmitter();

  private _unsubcribeFunction!: () => void;

  constructor(
    private readonly renderer: Renderer2,
    private readonly element: ElementRef
  ) {}

  public ngOnInit(): void {
    this._unsubcribeFunction = this.renderer.listen(this.element.nativeElement, 'click', event => {
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault();
        event.stopPropagation();
        document.getSelection().removeAllRanges();
        this.ctrlClickEvent.emit(event);
      }
    });
  }

  public ngOnDestroy(): void {
    if (!this._unsubcribeFunction) {
      return;
    }

    this._unsubcribeFunction();
  }
}
