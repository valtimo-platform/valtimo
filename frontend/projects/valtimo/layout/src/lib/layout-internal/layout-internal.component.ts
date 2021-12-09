/*
 * Copyright 2015-2020 Ritense BV, the Netherlands.
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

import {AfterViewInit, Component, ElementRef, Renderer2, ViewChild} from '@angular/core';
import {BehaviorSubject} from 'rxjs';
import {LayoutService} from '../layout.service';

declare var App;

@Component({
  selector: 'valtimo-layout-internal',
  templateUrl: './layout-internal.component.html',
  styleUrls: ['./layout-internal.component.scss']
})
export class LayoutInternalComponent implements AfterViewInit {
  @ViewChild('wrapper') wrapperRef: ElementRef;

  readonly menuOpen$ = new BehaviorSubject<boolean>(true);
  readonly menuWidth$ = new BehaviorSubject<number>(undefined);

  readonly observer = new MutationObserver((e: any) =>
    this.menuOpen$.next(!e[0].target.className.includes('be-collapsible-sidebar-collapsed'))
  );

  constructor(public layoutService: LayoutService, private renderer: Renderer2) {
    this.renderer.addClass(document.body, 'be-animate');
  }

  ngAfterViewInit(): void {
    App.init();

    this.observer.observe(this.wrapperRef.nativeElement, {
      attributes: true,
      attributeFilter: ['class'],
      childList: false,
      characterData: false
    });
  }

  menuWidthChanged(width: number): void {
    this.menuWidth$.next(width);
  }
}
