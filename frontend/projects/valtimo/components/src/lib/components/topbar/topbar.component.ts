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
  OnInit,
  ViewChild,
  ViewContainerRef,
} from '@angular/core';
import {KeycloakService} from 'keycloak-angular';
import {map, Observable, of, switchMap} from 'rxjs';
import {ConfigService, ValtimoConfig} from '@valtimo/config';
import {IconService} from 'carbon-components-angular';
import User20 from '@carbon/icons/es/user/20';
import {ShellService} from '../../services/shell.service';
import {DomSanitizer, SafeResourceUrl} from '@angular/platform-browser';
import {CdsThemeService, PageHeaderService} from '../../services';
import {CurrentCarbonTheme, TopbarLogo} from '../../models';

@Component({
  selector: 'valtimo-topbar',
  templateUrl: './topbar.component.html',
  styleUrls: ['./topbar.component.scss'],
})
export class TopbarComponent implements OnInit, AfterViewInit {
  @HostBinding('class.cds--header') headerClass = true;

  @ViewChild('headerVcr', {static: true, read: ViewContainerRef})
  private readonly _headerVcr!: ViewContainerRef;

  public readonly logoBase64$: Observable<SafeResourceUrl> =
    this.cdsThemeService.currentTheme$.pipe(
      map(currentTheme => {
        const base64logo = this.getBase64Logo(this.configService.config, currentTheme);

        return this.sanitizer.bypassSecurityTrustResourceUrl(
          `${base64logo.isSvg ? 'data:image/svg+xml;base64' : 'data:image/png;base64'}, ${base64logo.base64string}`
        );
      })
    );

  public readonly userFullName$ = of(this.keyCloakService.isLoggedIn()).pipe(
    switchMap(() => this.keyCloakService.loadUserProfile()),
    map(profile => `${profile.firstName} ${profile.lastName}`)
  );

  public readonly applicationTitle = this.configService.config.applicationTitle;
  public readonly largeLogoMargin = this.configService.config.featureToggles?.largeLogoMargin;
  public readonly sideBarExpanded$ = this.shellService.sideBarExpanded$;
  public readonly largeScreen$ = this.shellService.largeScreen$;
  public readonly panelExpanded$ = this.shellService.panelExpanded$;
  public readonly collapsibleWidescreenMenu$ = this.shellService.collapsibleWidescreenMenu$;
  public readonly showUserNameInTopBar$ = this.pageHeaderService.showUserNameInTopBar$;

  constructor(
    private readonly keyCloakService: KeycloakService,
    private readonly configService: ConfigService,
    private readonly iconService: IconService,
    private readonly shellService: ShellService,
    private readonly sanitizer: DomSanitizer,
    private readonly pageHeaderService: PageHeaderService,
    private readonly cdsThemeService: CdsThemeService
  ) {}

  public ngOnInit(): void {
    this.iconService.registerAll([User20]);
  }

  public ngAfterViewInit(): void {
    this.pageHeaderService.setHeaderViewContainerRef(this._headerVcr);
  }

  public toggleSideBar(): void {
    this.shellService.toggleSideBar();
  }

  public setPanelExpanded(expanded: boolean): void {
    this.shellService.setPanelExpanded(expanded);
  }

  public mouseEnter(): void {
    this.shellService.setMouseOnTopBar(true);
  }

  public mouseLeave(): void {
    this.shellService.setMouseOnTopBar(false);
  }

  private getBase64Logo(config: ValtimoConfig, currentTheme: CurrentCarbonTheme): TopbarLogo {
    const {logoSvgBase64, logoPngBase64, darkModeLogoSvgBase64, darkModeLogoPngBase64} =
      this.configService.config;
    let base64string!: string;
    let isSvg = true;

    switch (currentTheme) {
      case CurrentCarbonTheme.G10:
        if (logoSvgBase64) {
          base64string = logoSvgBase64;
        } else if (logoPngBase64) {
          base64string = logoPngBase64;
          isSvg = false;
        } else if (darkModeLogoSvgBase64) {
          base64string = darkModeLogoSvgBase64;
        } else {
          base64string = darkModeLogoPngBase64;
          isSvg = false;
        }
        break;
      case CurrentCarbonTheme.G90:
        if (darkModeLogoSvgBase64) {
          base64string = darkModeLogoSvgBase64;
        } else if (darkModeLogoPngBase64) {
          base64string = darkModeLogoPngBase64;
          isSvg = false;
        } else if (logoSvgBase64) {
          base64string = logoSvgBase64;
        } else {
          base64string = logoPngBase64;
          isSvg = false;
        }
        break;
    }

    return {
      isSvg,
      base64string,
    };
  }
}
