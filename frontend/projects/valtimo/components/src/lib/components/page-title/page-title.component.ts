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
  HostBinding,
  OnDestroy,
  OnInit,
  ViewChild,
  ViewContainerRef,
  ViewEncapsulation,
} from '@angular/core';
import {Title} from '@angular/platform-browser';
import {ActivatedRoute, Router} from '@angular/router';
import {TranslateService} from '@ngx-translate/core';
import {ConfigService} from '@valtimo/config';
import {NGXLogger} from 'ngx-logger';
import {
  BehaviorSubject,
  combineLatest,
  map,
  Observable,
  startWith,
  Subscription,
  switchMap,
  tap,
} from 'rxjs';
import {PageHeaderService, PageSubtitleService, PageTitleService} from '../../services';

@Component({
  selector: 'valtimo-page-title',
  templateUrl: './page-title.component.html',
  styleUrls: ['./page-title.component.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class PageTitleComponent implements OnInit, AfterViewInit, OnDestroy {
  @HostBinding('class.valtimo-page-title--compact') isCompact!: boolean;

  @ViewChild('subtitleVcr', {static: true, read: ViewContainerRef})
  private readonly _subtitleVcr!: ViewContainerRef;

  public hidePageTitle = false;
  public readonly appTitle = this.configService?.config?.applicationTitle || 'Valtimo';
  public readonly hasCustomPageTitle$: Observable<boolean> = this.router.events.pipe(
    startWith(this.router),
    switchMap(() => this.activatedRoute.firstChild.data),
    map(data => !!data?.customPageTitle)
  );
  public readonly customPageTitle$ = this.pageTitleService.customPageTitle$;
  public readonly customPageTitleSet$ = this.pageTitleService.customPageTitleSet$;
  public readonly translatedTitle$ = new BehaviorSubject<string>('');
  private appTitleAsSuffix =
    this.configService?.config?.featureToggles?.applicationTitleAsSuffix || false;
  private readonly _subscriptions = new Subscription();
  private readonly _hidePageTitle$: Observable<boolean> = this.router.events.pipe(
    startWith(this.router),
    switchMap(() => this.activatedRoute.firstChild.data),
    map(data => !!data?.hidePageTitle),
    tap(hidden => this.pageTitleService.setPageTitleHidden(hidden))
  );

  constructor(
    private readonly router: Router,
    private readonly activatedRoute: ActivatedRoute,
    private readonly titleService: Title,
    private readonly translateService: TranslateService,
    private readonly logger: NGXLogger,
    private readonly configService: ConfigService,
    private readonly pageTitleService: PageTitleService,
    private readonly pageHeaderService: PageHeaderService,
    private readonly pageSubtitleService: PageSubtitleService
  ) {}

  public ngOnInit(): void {
    this.openRouterTranslateSubscription();
    this.openHidePageTitleSubscription();
    this.openCompactModeSubscription();
  }

  public ngAfterViewInit(): void {
    this.pageSubtitleService.setTitleViewContainerRef(this._subtitleVcr);
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  private openRouterTranslateSubscription(): void {
    this._subscriptions.add(
      combineLatest([
        this.router.events.pipe(startWith(null)),
        this.translateService.stream('key'),
      ]).subscribe(() => {
        const routeTitle =
          this.activatedRoute?.snapshot?.firstChild?.data?.title ||
          this.activatedRoute?.snapshot?.firstChild?.children[0]?.data?.title;
        const routeTitleTranslation = this.translateService.instant(routeTitle);
        const routeTitlePageTranslationString = `pages.${routeTitle?.toLowerCase()}.title`;
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
      })
    );
  }

  private openHidePageTitleSubscription(): void {
    this._subscriptions.add(
      this._hidePageTitle$.subscribe(hidePageTitle => {
        this.hidePageTitle = hidePageTitle;
      })
    );
  }

  private openCompactModeSubscription(): void {
    this._subscriptions.add(
      this.pageHeaderService.compactMode$.subscribe(compactMode => {
        this.isCompact = compactMode;
      })
    );
  }
}
