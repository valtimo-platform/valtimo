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

import {
  AfterViewInit,
  Component,
  OnDestroy,
  OnInit,
  ViewChild,
  ViewContainerRef,
  ViewEncapsulation,
} from '@angular/core';
import {ActivatedRoute, Router} from '@angular/router';
import {Title} from '@angular/platform-browser';
import {BehaviorSubject, combineLatest, Observable, startWith, Subscription, switchMap} from 'rxjs';
import {TranslateService} from '@ngx-translate/core';
import {NGXLogger} from 'ngx-logger';
import {ConfigService} from '@valtimo/config';
import {map} from 'rxjs/operators';
import {PageTitleService} from './page-title.service';

@Component({
  selector: 'valtimo-page-title',
  templateUrl: './page-title.component.html',
  styleUrls: ['./page-title.component.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class PageTitleComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('pageActionsVcr', {static: true, read: ViewContainerRef})
  pageActionsVcr!: ViewContainerRef;
  public appTitle = this.configService?.config?.applicationTitle || 'Valtimo';
  public readonly hidePageTitle$: Observable<boolean> = this.router.events.pipe(
    startWith(this.router),
    switchMap(() => this.activatedRoute.firstChild.data),
    map(data => !!data?.hidePageTitle)
  );
  public readonly hasCustomPageTitle$: Observable<boolean> = this.router.events.pipe(
    startWith(this.router),
    switchMap(() => this.activatedRoute.firstChild.data),
    map(data => !!data?.customPageTitle)
  );
  public readonly hasCustomPageSubtitle$: Observable<boolean> = this.router.events.pipe(
    startWith(this.router),
    switchMap(() => this.activatedRoute.firstChild.data),
    map(data => !!data?.customPageSubtitle)
  );
  public readonly customPageTitle$ = this.pageTitleService.customPageTitle$;
  public readonly customPageTitleSet$ = this.pageTitleService.customPageTitleSet$;
  public readonly customPageSubtitle$ = this.pageTitleService.customPageSubtitle$;
  public readonly customPageSubtitleSet$ = this.pageTitleService.customPageSubtitleSet$;
  public readonly hasPageActions$ = this.pageTitleService.hasPageActions$;

  readonly translatedTitle$ = new BehaviorSubject<string>('');
  private appTitleAsSuffix =
    this.configService?.config?.featureToggles?.applicationTitleAsSuffix || false;
  private routerTranslateSubscription!: Subscription;

  constructor(
    private readonly router: Router,
    private readonly activatedRoute: ActivatedRoute,
    private readonly titleService: Title,
    private readonly translateService: TranslateService,
    private readonly logger: NGXLogger,
    private readonly configService: ConfigService,
    private readonly pageTitleService: PageTitleService
  ) {}

  ngOnInit() {
    this.openRouterTranslateSubscription();
  }

  ngAfterViewInit(): void {
    this.pageTitleService.setPageActionsViewContainerRef(this.pageActionsVcr);
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
        if (this.appTitleAsSuffix) {
          this.titleService.setTitle(translatedRouteTitle + ' - ' + this.appTitle);
        } else {
          this.titleService.setTitle(this.appTitle + ' - ' + translatedRouteTitle);
        }
      } else {
        this.logger.debug('PageTitle: setTitle default', this.appTitle);
        this.translatedTitle$.next('');
        this.titleService.setTitle(this.appTitle);
      }
    });
  }
}
