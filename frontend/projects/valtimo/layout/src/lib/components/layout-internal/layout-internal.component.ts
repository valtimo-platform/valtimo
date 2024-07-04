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

import {AfterViewInit, Component, ElementRef, OnDestroy, Renderer2, ViewChild} from '@angular/core';
import {LayoutService} from '../../services/layout/layout.service';
import {ShellService, UserInterfaceService} from '@valtimo/components';

// eslint-disable-next-line no-var
declare var App;

@Component({
  selector: 'valtimo-layout-internal',
  templateUrl: './layout-internal.component.html',
  styleUrls: ['./layout-internal.component.scss'],
})
export class LayoutInternalComponent implements AfterViewInit, OnDestroy {
  @ViewChild('mainContent') mainContentRef: ElementRef;

  public readonly showPageHeader$ = this.userInterfaceService.showPageHeader$;
  public readonly sideBarExpanded$ = this.shellService.sideBarExpanded$;
  public readonly collapsibleWidescreenMenu$ = this.shellService.collapsibleWidescreenMenu$;

  private _observer!: ResizeObserver;

  constructor(
    public layoutService: LayoutService,
    private readonly renderer: Renderer2,
    private readonly userInterfaceService: UserInterfaceService,
    private readonly shellService: ShellService
  ) {
    this.renderer.addClass(document.body, 'be-animate');
  }

  public ngAfterViewInit(): void {
    App.init();
    this.shellService.setContentElement(this.mainContentRef.nativeElement);
    this._observer = new ResizeObserver(() => {
      this.shellService.onMainContentResize();
    });
    this._observer.observe(this.mainContentRef.nativeElement);
  }

  public ngOnDestroy(): void {
    this._observer.disconnect();
  }
}
