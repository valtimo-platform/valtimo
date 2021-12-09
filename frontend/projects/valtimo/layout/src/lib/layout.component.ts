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

import {Component, OnDestroy, OnInit} from '@angular/core';
import {ActivatedRoute, NavigationEnd, Router} from '@angular/router';
import {filter} from 'rxjs/operators';
import {Subscription} from 'rxjs';

declare var App: any;

@Component({
  selector: 'valtimo-layout',
  templateUrl: './layout.component.html'
})
export class LayoutComponent implements OnInit, OnDestroy {

  public layoutType: string | null = null;
  private routerSub = Subscription.EMPTY;
  private defaultLayout = 'internal';

  constructor(private router: Router, private route: ActivatedRoute) {
  }

  ngOnInit() {
    this.routerSub = this.router.events.pipe(filter(event => event instanceof NavigationEnd)).subscribe(() => {
      const layout = this.route.snapshot.firstChild.data.layout;
      this.layoutType = layout ? layout : this.defaultLayout;
    });
  }

  ngOnDestroy() {
    this.routerSub.unsubscribe();
  }

}
