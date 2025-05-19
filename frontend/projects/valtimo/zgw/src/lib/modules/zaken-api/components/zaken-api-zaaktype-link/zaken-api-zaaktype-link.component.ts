/*
 * Copyright 2015-2025 Ritense BV, the Netherlands.
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
import {CommonModule} from '@angular/common';
import {Component, OnInit} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {ActivatedRoute} from '@angular/router';
import {Edit16, Save16, TrashCan16} from '@carbon/icons';
import {TranslateModule, TranslateService} from '@ngx-translate/core';
import {CaseManagementParams, getCaseManagementRouteParams} from '@valtimo/case-management';
import {SpinnerModule} from '@valtimo/components';
import {GlobalNotificationService} from '@valtimo/shared';
import {PluginConfiguration} from '@valtimo/plugin';
import {
  CreateZaakTypeLinkRequest,
  InformatieObjectType,
  OpenZaakService,
  ZaakType,
  ZaakTypeLink,
} from '@valtimo/resource';
import {
  ButtonModule,
  IconModule,
  IconService,
  InputModule,
  LayerModule,
  ModalModule,
  NotificationModule,
  SelectModule,
  TilesModule,
  ToggleModule,
} from 'carbon-components-angular';
import {BehaviorSubject, finalize, switchMap} from 'rxjs';
import {ZakenApiZaaktypeLinkService} from '../../services';

@Component({
  selector: 'valtimo-zaken-api-zaaktype-link',
  templateUrl: './zaken-api-zaaktype-link.component.html',
  styleUrls: ['./zaken-api-zaaktype-link.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    NotificationModule,
    TranslateModule,
    ButtonModule,
    IconModule,
    TilesModule,
    LayerModule,
    SpinnerModule,
    ModalModule,
    SelectModule,
    InputModule,
    ToggleModule,
  ],
})
export class ZakenApiZaaktypeLinkComponent implements OnInit {
  public zaakTypes: ZaakType[];
  public pluginConfigurations: PluginConfiguration[];
  public zaakTypeLinkRequest: CreateZaakTypeLinkRequest;
  public informatieObjectTypes: InformatieObjectType[];
  public selectedZaakType: ZaakType | null = null;
  public selectedPluginConfiguration: PluginConfiguration | null = null;
  public selectedInformatieObjectTypeUrl: string | null = null;
  private _caseDefinitionKey: string;
  private _caseVersionTag: string;

  public readonly loading$ = new BehaviorSubject<boolean>(true);
  public readonly zaakTypeLink$ = new BehaviorSubject<ZaakTypeLink | null>(null);
  public readonly modalOpen$ = new BehaviorSubject<boolean>(false);

  constructor(
    private readonly globalNotificationService: GlobalNotificationService,
    private readonly iconService: IconService,
    private readonly openZaakService: OpenZaakService,
    private readonly route: ActivatedRoute,
    private readonly translateService: TranslateService,
    private readonly zakenApiZaaktypeLinkService: ZakenApiZaaktypeLinkService
  ) {
    this.iconService.registerAll([Edit16, TrashCan16, Save16]);
  }

  public ngOnInit(): void {
    getCaseManagementRouteParams(this.route)
      .pipe(
        switchMap((params: CaseManagementParams | undefined) => {
          this._caseDefinitionKey = params?.caseDefinitionKey ?? '';
          this._caseVersionTag = params?.caseDefinitionVersionTag ?? '';
          this.zaakTypeLinkRequest = {
            caseDefinitionKey: this._caseDefinitionKey,
            caseVersionTag: this._caseVersionTag,
            createWithDossier: false,
          };

          return this.openZaakService.getZaakTypeLink(
            this._caseDefinitionKey,
            this._caseVersionTag
          );
        })
      )
      .subscribe(zaakTypeLink => {
        if (zaakTypeLink !== null) {
          this.zaakTypeLinkRequest = {
            caseDefinitionKey: this._caseDefinitionKey,
            caseVersionTag: this._caseVersionTag,
            createWithDossier: zaakTypeLink?.createWithDossier,
            rsin: zaakTypeLink?.rsin,
            zakenApiPluginConfigurationId: zaakTypeLink?.zakenApiPluginConfigurationId,
            zaakTypeUrl: zaakTypeLink?.zaakTypeUrl,
          };
        }
        this.zaakTypeLink$.next(zaakTypeLink);
        this.loadZaakTypes();
        this.loadZakenApiPluginConfigurations();
        this.loading$.next(false);
      });
  }

  public loadZaakTypes(): void {
    this.openZaakService.getZaakTypes().subscribe((zaakTypes: ZaakType[]) => {
      this.zaakTypes = zaakTypes;
      this.findZaakType(this.zaakTypeLink$.getValue()?.zaakTypeUrl ?? '');
      this.loading$.next(false);
    });
  }

  public loadZakenApiPluginConfigurations(): void {
    this.zakenApiZaaktypeLinkService
      .getPluginConfigurationsByPluginDefinitionKey('zakenapi')
      .subscribe((plugins: PluginConfiguration[]) => {
        this.pluginConfigurations = plugins;
        this.findPluginConfiguration(
          this.zaakTypeLink$.getValue()?.zakenApiPluginConfigurationId ?? ''
        );
      });
  }

  public loadInformatieObjectTypeUrls(): void {
    this.openZaakService
      .getInformatieObjectTypes()
      .subscribe((informatieObjectTypes: InformatieObjectType[]) => {
        this.informatieObjectTypes = informatieObjectTypes;
      });
  }

  public closeModal(): void {
    this.modalOpen$.next(false);
  }

  public openModal(zaakTypeLink: ZaakTypeLink): void {
    this.zaakTypeLinkRequest = {
      caseDefinitionKey: this._caseDefinitionKey,
      caseVersionTag: this._caseVersionTag,
      createWithDossier: zaakTypeLink?.createWithDossier,
      rsin: zaakTypeLink?.rsin,
      zakenApiPluginConfigurationId: zaakTypeLink?.zakenApiPluginConfigurationId,
      zaakTypeUrl: zaakTypeLink?.zaakTypeUrl,
    };

    this.modalOpen$.next(true);
  }

  public onCheckedChange(checked: boolean): void {
    this.zaakTypeLinkRequest.createWithDossier = checked;
  }

  public removeZaakTypeLink(): void {
    this.openZaakService
      .deleteZaakTypeLink(this._caseDefinitionKey, this._caseVersionTag)
      .subscribe({
        next: () => {
          this.globalNotificationService.showToast({
            title: this.translateService.instant('openZaak.delinkSuccessful'),
            type: 'success',
          });
          this.zaakTypeLink$.next(null);
        },
        error: () => {
          this.globalNotificationService.showToast({
            title: this.translateService.instant('openZaak.delinkFailed'),
            type: 'error',
          });
        },
      });
  }

  public submit(): void {
    this.openZaakService
      .createZaakTypeLink(this.zaakTypeLinkRequest)
      .pipe(finalize(() => this.modalOpen$.next(false)))
      .subscribe({
        next: linkResult => {
          this.zaakTypeLink$.next(linkResult);
          this.zaakTypeLinkRequest = {
            caseDefinitionKey: this._caseDefinitionKey,
            caseVersionTag: this._caseVersionTag,
            createWithDossier: linkResult?.createWithDossier,
            rsin: linkResult?.rsin,
            zakenApiPluginConfigurationId: linkResult?.zakenApiPluginConfigurationId,
            zaakTypeUrl: linkResult?.zaakTypeUrl,
          };
          this.findZaakType(linkResult.zaakTypeUrl);
          this.findPluginConfiguration(linkResult.zakenApiPluginConfigurationId);
          this.globalNotificationService.showToast({
            title: this.translateService.instant('openZaak.linkSuccessful'),
            type: 'success',
          });
        },
        error: () => {
          this.globalNotificationService.showToast({
            title: this.translateService.instant('openZaak.linkFailed'),
            type: 'error',
          });
        },
      });
  }

  private findZaakType(zaakTypeUrl: string): void {
    this.selectedZaakType = this.zaakTypes.find(zaakType => zaakType.url === zaakTypeUrl) ?? null;
  }

  private findPluginConfiguration(pluginConfigurationId: string): void {
    this.selectedPluginConfiguration =
      this.pluginConfigurations.find(
        pluginConfiguration => pluginConfiguration.id === pluginConfigurationId
      ) ?? null;
  }
}
