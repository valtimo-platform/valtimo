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
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  OnInit,
  ViewEncapsulation,
} from '@angular/core';
import {FormBuilder, FormControl, FormGroup} from '@angular/forms';
import {TranslateService} from '@ngx-translate/core';
import {SelectableCarbonTheme, ValtimoVersion} from '../../models';
import {
  ConfigService,
  EmailNotificationSettings,
  FeedbackMailTo,
  UserIdentity,
  UserSettings,
  UserSettingsService,
  ValtimoConfig,
  VERSIONS,
} from '@valtimo/config';
import {UserProviderService} from '@valtimo/security';
import {BehaviorSubject, combineLatest, Observable, Subscription, switchMap, take} from 'rxjs';
import {VersionService} from '../version/version.service';
import {CdsThemeService, PageHeaderService, ShellService} from '../../services';
import {map, tap} from 'rxjs/operators';
import {ListItem} from 'carbon-components-angular';

@Component({
  selector: 'valtimo-right-sidebar',
  templateUrl: './right-sidebar.component.html',
  styleUrls: ['./right-sidebar.component.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class RightSidebarComponent implements OnInit, OnDestroy {
  @HostListener('document:click', ['$event.target'])
  public onPageClick(targetElement) {
    combineLatest([this.shellService.panelExpanded$, this.shellService.mouseOnTopBar$])
      .pipe(take(1))
      .subscribe(([panelExpanded, mouseOnTopBar]) => {
        const clickedInside =
          this.elementRef.nativeElement.contains(targetElement) || mouseOnTopBar;

        if (!clickedInside && panelExpanded) {
          this.shellService.setPanelExpanded(false);
        }
      });
  }

  public readonly settingsForm: FormGroup = this.formBuilder.group({
    taskNotifications: new FormControl(false),
    emailNotifications: new FormControl(false),
    emailNotificationOnMonday: new FormControl(false),
    emailNotificationOnTuesday: new FormControl(false),
    emailNotificationOnWednesday: new FormControl(false),
    emailNotificationOnThursday: new FormControl(false),
    emailNotificationOnFriday: new FormControl(false),
    emailNotificationOnSaturday: new FormControl(false),
    emailNotificationOnSunday: new FormControl(false),
  });

  public readonly panelExpanded$ = this.shellService.panelExpanded$;

  private readonly _selectedLanguage$ = new BehaviorSubject<string>('');
  private readonly _languageOptions$ = new BehaviorSubject<Array<string>>([]);

  public readonly languageListItems$: Observable<ListItem[]> = combineLatest([
    this._languageOptions$,
    this._selectedLanguage$,
    this.translateService.stream('key'),
  ]).pipe(
    map(([languageOptions, selectedLanguage]) =>
      languageOptions.map(languageKey => ({
        content: this.translateService.instant('settings.language.options.' + languageKey),
        key: languageKey,
        selected: selectedLanguage === languageKey,
      }))
    )
  );

  public readonly backendVersion$: Observable<ValtimoVersion> = this.versionService.getVersion();
  public readonly userSubject$: Observable<UserIdentity> =
    this.userProviderService.getUserSubject();
  public readonly updatingSettings$ = new BehaviorSubject<boolean>(true);
  public readonly updatingUserSettings$ = new BehaviorSubject<boolean>(true);

  private readonly _emailNotificationSettings$ = new BehaviorSubject<EmailNotificationSettings>(
    undefined
  );

  public readonly emailNotificationSettingsWithSideEffects$: Observable<EmailNotificationSettings> =
    this._emailNotificationSettings$.pipe(
      tap(results => {
        if (results) {
          this.settingsForm.setValue(results);
          this.updatingSettings$.next(false);
        }
      })
    );

  public readonly collapsibleWidescreenMenu$ = this.shellService.collapsibleWidescreenMenu$;
  public readonly compactMode$ = this.pageHeaderService.compactMode$;
  public readonly showUserNameInTopBar$ = this.pageHeaderService.showUserNameInTopBar$;

  private readonly _preferredTheme$ = this.cdsThemeService.preferredTheme$;

  public frontendVersion!: string;

  public showValtimoVersions = true;

  public readonly themeOptions$: Observable<ListItem[]> = combineLatest([
    this._preferredTheme$,
    this.translateService.stream('key'),
  ]).pipe(
    map(([preferredTheme]) => [
      {
        content: this.translateService.instant('settings.interface.themes.light'),
        key: SelectableCarbonTheme.G10,
        selected: preferredTheme === SelectableCarbonTheme.G10,
      },
      {
        content: this.translateService.instant('settings.interface.themes.dark'),
        key: SelectableCarbonTheme.G90,
        selected: preferredTheme === SelectableCarbonTheme.G90,
      },
      {
        content: this.translateService.instant('settings.interface.themes.system'),
        key: SelectableCarbonTheme.SYSTEM,
        selected: preferredTheme === SelectableCarbonTheme.SYSTEM,
      },
    ])
  );

  public overrideFeedbackMenuItemToMailTo!: FeedbackMailTo;
  public allowUserThemeSwitching = true;
  public enableCompactModeToggle = true;
  public enableShowUserNameToggle = false;
  public showPlantATreeButton = false;
  public resetUrl!: string;

  private _hideValtimoVersionsForNonAdmins = false;

  private readonly _isAdmin$: Observable<boolean> = this.userProviderService
    .getUserSubject()
    .pipe(map(userIdentity => userIdentity?.roles.includes('ROLE_ADMIN')));

  private readonly _subscriptions = new Subscription();

  constructor(
    private readonly translateService: TranslateService,
    private readonly userProviderService: UserProviderService,
    private readonly formBuilder: FormBuilder,
    private readonly versionService: VersionService,
    private readonly shellService: ShellService,
    private readonly elementRef: ElementRef,
    private readonly configService: ConfigService,
    private readonly userSettingsService: UserSettingsService,
    private readonly pageHeaderService: PageHeaderService,
    private readonly cdsThemeService: CdsThemeService
  ) {}

  public ngOnInit(): void {
    this.initSettings();
    this.initFrontendVersion();
    this.openShowVersionsSubscription();
    this.setLanguage();
    this.loadEmailNotificationSettings();
    this.openFormSubscription();
    this.getUserSettings();
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  public updateUserLanguage(langKey: string | {item?: {key?: string}}, saveSettings = true): void {
    const langKeyToUse = (langKey as any)?.item?.key
      ? (langKey as any)?.item.key
      : (langKey as string);

    this.translateService
      .use(langKeyToUse)
      .pipe(take(1))
      .subscribe(() => {
        localStorage.setItem('langKey', langKeyToUse);
        this._selectedLanguage$.next(langKeyToUse);

        if (saveSettings) {
          this.saveUserSettings();
        }
      });
  }

  public setCollapsibleWidescreenMenu(collapsible: boolean, saveSettings = true): void {
    this.shellService.setCollapsibleWidescreenMenu(collapsible);

    if (saveSettings) {
      this.saveUserSettings();
    }
  }

  public setCompactMode(compactMode: boolean, saveSettings = true): void {
    this.pageHeaderService.setCompactMode(compactMode);

    if (saveSettings) {
      this.saveUserSettings();
    }
  }

  public setShowUserName(showUserName: boolean, saveSettings = true): void {
    this.pageHeaderService.setShowUserNameInTopBar(showUserName);

    if (saveSettings) {
      this.saveUserSettings();
    }
  }

  public setPreferredTheme(
    selectedTheme: string | {item?: {key?: string}},
    saveSettings = true
  ): void {
    if (this.allowUserThemeSwitching) {
      if ((selectedTheme as any)?.item?.key) {
        this.cdsThemeService.setPreferredTheme(
          (selectedTheme as any).item?.key as SelectableCarbonTheme
        );
      } else {
        this.cdsThemeService.setPreferredTheme(selectedTheme as SelectableCarbonTheme);
      }

      if (saveSettings) {
        this.saveUserSettings();
      }
    }
  }

  public logout(): void {
    this.userProviderService.logout();
  }

  private initSettings(): void {
    const config: ValtimoConfig = this.configService?.config;
    const featureToggles = config?.featureToggles || {};

    this.resetUrl = config?.changePasswordUrl?.endpointUri;
    this.overrideFeedbackMenuItemToMailTo = config?.overrideFeedbackMenuItemToMailTo;

    this.enableShowUserNameToggle = !!featureToggles.enableUserNameInTopBarToggle;
    this.showPlantATreeButton = !!featureToggles.showPlantATreeButton;

    if (featureToggles.hasOwnProperty('allowUserThemeSwitching')) {
      this.allowUserThemeSwitching = !!featureToggles.allowUserThemeSwitching;
    }

    if (featureToggles.hasOwnProperty('enableCompactModeToggle')) {
      this.enableCompactModeToggle = !!featureToggles.enableCompactModeToggle;
    }

    if (featureToggles.hasOwnProperty('hideValtimoVersionsForNonAdmins')) {
      this._hideValtimoVersionsForNonAdmins = !!featureToggles.hideValtimoVersionsForNonAdmins;
    }
  }

  private initFrontendVersion(): void {
    this.frontendVersion = VERSIONS?.frontendLibraries;
  }

  private openFormSubscription(): void {
    this._subscriptions.add(
      combineLatest([
        this._emailNotificationSettings$,
        this.settingsForm.valueChanges,
        this.updatingSettings$,
      ])
        .pipe(
          tap(([settings, formValue, updatingSettings]) => {
            if (settings && formValue) {
              const settingsStringified = JSON.stringify(this.sortObjectAlphabetically(settings));
              const formStringified = JSON.stringify(this.sortObjectAlphabetically(formValue));

              if (settingsStringified !== formStringified && !updatingSettings) {
                this.updatingSettings$.next(true);
                this.userProviderService.updateEmailNotificationSettings(formValue).subscribe(
                  results => {
                    this._emailNotificationSettings$.next(results);
                    this.updatingSettings$.next(false);
                  },
                  () => {
                    this._emailNotificationSettings$.next(settings);
                    this.updatingSettings$.next(false);
                  }
                );
              }
            }
          })
        )
        .subscribe()
    );
  }

  private loadEmailNotificationSettings(): void {
    this.userProviderService.getEmailNotificationSettings().subscribe(results => {
      if (results) {
        this._emailNotificationSettings$.next(results);
      } else {
        this._emailNotificationSettings$.next(this.settingsForm.value);
      }
    });
  }

  private setLanguage(): void {
    this._selectedLanguage$.next(this.translateService.currentLang);
    this._languageOptions$.next(this.translateService.langs);
  }

  private sortObjectAlphabetically(jsObject: object): object {
    return Object.keys(jsObject)
      .sort()
      .reduce(
        (acc, key) => ({
          ...acc,
          [key]: jsObject[key],
        }),
        {}
      );
  }

  private getUserSettings(): void {
    this.userSettingsService.getUserSettings().subscribe(settings => {
      this.updatingUserSettings$.next(false);

      if (!settings?.languageCode) {
        this.saveUserSettings();
      } else {
        this.setUserSettings(settings);
      }
    });
  }

  private saveUserSettings(): void {
    this.updatingUserSettings$.next(true);

    combineLatest([
      this._selectedLanguage$,
      this.collapsibleWidescreenMenu$,
      this.compactMode$,
      this.showUserNameInTopBar$,
      this._preferredTheme$,
    ])
      .pipe(
        take(1),
        switchMap(
          ([
            languageCode,
            collapsibleWidescreenMenu,
            compactMode,
            showUserNameInTopBar,
            preferredTheme,
          ]) =>
            this.userSettingsService.saveUserSettings({
              collapsibleWidescreenMenu,
              languageCode,
              ...(this.enableCompactModeToggle && {compactMode}),
              ...(this.enableShowUserNameToggle && {showUserNameInTopBar}),
              ...(this.allowUserThemeSwitching && {preferredTheme}),
            })
        )
      )
      .subscribe(() => {
        this.updatingUserSettings$.next(false);
      });
  }

  private setUserSettings(settings: UserSettings): void {
    this._selectedLanguage$.next(settings.languageCode);
    this.updateUserLanguage(settings.languageCode, false);
    this.setCollapsibleWidescreenMenu(settings.collapsibleWidescreenMenu, false);
    if (this.enableCompactModeToggle) this.setCompactMode(settings.compactMode, false);
    if (this.enableShowUserNameToggle) this.setShowUserName(settings.showUserNameInTopBar, false);
    if (settings.preferredTheme && this.allowUserThemeSwitching) {
      this.setPreferredTheme(settings.preferredTheme, false);
    }
  }

  private openShowVersionsSubscription(): void {
    this._subscriptions.add(
      this._isAdmin$.subscribe(isAdmin => {
        if (this._hideValtimoVersionsForNonAdmins && !isAdmin) {
          this.showValtimoVersions = false;
        }
      })
    );
  }
}
