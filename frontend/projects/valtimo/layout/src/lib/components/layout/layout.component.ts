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
  AfterViewInit,
  Component,
  OnDestroy,
  OnInit,
  ViewChild,
  ViewContainerRef,
} from '@angular/core';
import {ActivatedRoute, NavigationEnd, Router} from '@angular/router';
import {filter} from 'rxjs/operators';
import {Subscription} from 'rxjs';
import {PlaceholderService} from 'carbon-components-angular';

// eslint-disable-next-line no-var
declare var App: any;

@Component({
  selector: 'valtimo-layout',
  templateUrl: './layout.component.html',
})
export class LayoutComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('carbonPlaceHolder', {static: true, read: ViewContainerRef})
  private readonly _carbonPlaceHolder: ViewContainerRef;

  public layoutType: string | null = null;
  private readonly _routerSub = new Subscription();
  private readonly _DEFAULT_LAYOUT = 'internal';

  constructor(
    private readonly router: Router,
    private readonly route: ActivatedRoute,
    private readonly placeHolderService: PlaceholderService
  ) {}

  public ngOnInit() {
    this.openRouterSubscription();
  }

  public ngAfterViewInit(): void {
    this.registerCarbonPlaceHolder();
  }

  public ngOnDestroy() {
    this._routerSub.unsubscribe();
  }

  private registerCarbonPlaceHolder(): void {
    if (this._carbonPlaceHolder) {
      this.placeHolderService.registerViewContainerRef(this._carbonPlaceHolder);
    }
  }

  private openRouterSubscription(): void {
    this._routerSub.add(
      this.router.events.pipe(filter(event => event instanceof NavigationEnd)).subscribe(() => {
        const layout = this.route.snapshot.firstChild.data.layout;
        this.layoutType = layout ? layout : this._DEFAULT_LAYOUT;
      })
    );
  }
}
