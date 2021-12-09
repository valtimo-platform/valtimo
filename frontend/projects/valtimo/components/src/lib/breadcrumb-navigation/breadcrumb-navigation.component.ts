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
import {ActivatedRoute, NavigationEnd, PRIMARY_OUTLET, Router} from '@angular/router';
import {filter, map} from 'rxjs/operators';
import {Subscription} from 'rxjs';

@Component({
  selector: 'valtimo-breadcrumb-navigation',
  templateUrl: './breadcrumb-navigation.component.html',
  styleUrls: ['./breadcrumb-navigation.component.css']
})
export class BreadcrumbNavigationComponent implements OnInit, OnDestroy {

  public breadcrumbs: Array<any> = [];
  public appTitle = 'Valtimo';
  private routerSub = Subscription.EMPTY;

  constructor(
    private router: Router,
    private route: ActivatedRoute
  ) {
  }

  ngOnInit() {
    this.setBreadcrumbs(this.route);
    this.routerSub = this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .pipe(map(() => this.route))
      .pipe(map((route) => {
        while (route.firstChild) {
          route = route.firstChild;
        }
        return route;
      }))
      .pipe(filter(route => route.outlet === PRIMARY_OUTLET))
      .subscribe(route => {
        this.setBreadcrumbs(route);
      });
  }

  private setBreadcrumbs(route: ActivatedRoute) {
    while (route.firstChild) {
      route = route.firstChild;
    }
    if (route.outlet === PRIMARY_OUTLET) {
      const snapshot = route.snapshot;
      const activeRoute = {
        url: snapshot.url.join('/'),
        path: snapshot.routeConfig.path,
        label: snapshot.data['title'],
        params: snapshot.params
      };
      this.generateBreadcrumbs(activeRoute);
    }
  }

  private generateBreadcrumbs(activeBreadcrumb: any) {
    this.breadcrumbs = [];
    this.router.config.map(routerConfig => {
      if (activeBreadcrumb.path.indexOf(routerConfig.path + '/') === 0
        && activeBreadcrumb.path !== routerConfig.path
        && routerConfig.path !== ''
      ) {
        const parentRoute = {
          url: routerConfig.path.replace(/:(.+?)\b/g, (_, p1) => activeBreadcrumb.params[p1]),
          path: routerConfig.path,
          label: routerConfig.data['title'],
          params: activeBreadcrumb.params
        };
        const exist = this.breadcrumbs.findIndex(item => item.url === parentRoute.url);
        if (exist === -1) {
          this.breadcrumbs.push(parentRoute);
        }
      }
    });
  }

  ngOnDestroy() {
    this.routerSub.unsubscribe();
  }

}
