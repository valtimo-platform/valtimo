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
import {Title} from '@angular/platform-browser';
import {filter} from 'rxjs/operators';
import {Subscription} from 'rxjs';
import {TranslateService} from '@ngx-translate/core';
import {NGXLogger} from 'ngx-logger';

@Component({
  selector: 'valtimo-page-title',
  templateUrl: './page-title.component.html',
  styleUrls: ['./page-title.component.css']
})
export class PageTitleComponent implements OnInit, OnDestroy {

  public title: string;
  public appTitle = 'Valtimo';
  private routerSub = Subscription.EMPTY;

  constructor(
    private router: Router,
    private activatedRoute: ActivatedRoute,
    private titleService: Title,
    private translateService: TranslateService,
    private logger: NGXLogger
  ) {
  }

  private setTitle() {
    this.title = this.activatedRoute.snapshot.firstChild.data.title;

    // When loading lazy title is nested
    if (!this.title) {
      this.title = this.activatedRoute.snapshot.firstChild.children[0].data.title;
    }
    if (this.title) {
      this.translateService.stream(this.title).subscribe((title: string) => {
          this.logger.debug('PageTitle: setTitle translated async', title);
          this.titleService.setTitle(this.appTitle + ' - ' + title);
        }
      );
    } else {
      this.logger.debug('PageTitle: setTitle default', this.appTitle);
      this.titleService.setTitle(this.appTitle);
    }
  }

  ngOnInit() {
    this.setTitle();
    this.routerSub = this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe((event) => {
        this.setTitle();
      });
  }

  ngOnDestroy() {
    this.routerSub.unsubscribe();
  }

}
