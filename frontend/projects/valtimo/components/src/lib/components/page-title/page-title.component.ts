/*
 * Copyright 2015-2023 Ritense BV, the Netherlands.
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
import {ActivatedRoute, Router} from '@angular/router';
import {Title} from '@angular/platform-browser';
import {BehaviorSubject, combineLatest, Subscription} from 'rxjs';
import {TranslateService} from '@ngx-translate/core';
import {NGXLogger} from 'ngx-logger';
import {ConfigService} from '@valtimo/config';

@Component({
  selector: 'valtimo-page-title',
  templateUrl: './page-title.component.html',
  styleUrls: ['./page-title.component.css'],
})
export class PageTitleComponent implements OnInit, OnDestroy {
  public appTitle = this.configService?.config?.applicationTitle || 'Valtimo';
  readonly translatedTitle$ = new BehaviorSubject<string>('');
  private routerTranslateSubscription!: Subscription;

  constructor(
    private readonly router: Router,
    private readonly activatedRoute: ActivatedRoute,
    private readonly titleService: Title,
    private readonly translateService: TranslateService,
    private readonly logger: NGXLogger,
    private readonly configService: ConfigService
  ) {}

  ngOnInit() {
    this.openRouterTranslateSubscription();
  }

  ngOnDestroy() {
    this.routerTranslateSubscription?.unsubscribe();
  }

  private openRouterTranslateSubscription(): void {
    this.routerTranslateSubscription = combineLatest([
      this.router.events,
      this.translateService.stream('key'),
    ]).subscribe(() => {
      const routeTitle =
        this.activatedRoute?.snapshot?.firstChild?.data?.title ||
        this.activatedRoute?.snapshot?.firstChild?.children[0]?.data?.title;
      const routeTitleTranslation = this.translateService.instant(routeTitle);
      const routeTitlePageTranslationString = `pages.${routeTitle.toLowerCase()}.title`;
      const routeTitlePageTranslation = this.translateService.instant(
        routeTitlePageTranslationString
      );
      const translatedRouteTitle =
        routeTitle &&
        ((routeTitlePageTranslation !== routeTitlePageTranslationString
          ? routeTitlePageTranslation
          : '') ||
          (routeTitle !== routeTitleTranslation ? routeTitleTranslation : '') ||
          routeTitle);

      if (translatedRouteTitle) {
        this.logger.debug('PageTitle: setTitle translated async', translatedRouteTitle);
        this.translatedTitle$.next(translatedRouteTitle);
        this.titleService.setTitle(this.appTitle + ' - ' + translatedRouteTitle);
      } else {
        this.logger.debug('PageTitle: setTitle default', this.appTitle);
        this.translatedTitle$.next('');
        this.titleService.setTitle(this.appTitle);
      }
    });
  }
}
