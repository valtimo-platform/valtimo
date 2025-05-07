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
import {Component, OnInit, ViewChild} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {ActivatedRoute} from '@angular/router';
import {Edit16, TrashCan16} from '@carbon/icons';
import {TranslateModule, TranslateService} from '@ngx-translate/core';
import {CaseManagementParams, getCaseManagementRouteParams} from '@valtimo/case-management';
import {AlertService, ModalComponent, ModalModule} from '@valtimo/components';
import {ConfigService, UploadProvider} from '@valtimo/config';
import {PluginConfiguration} from '@valtimo/plugin';
import {
  CreateInformatieObjectTypeLinkRequest,
  CreateZaakTypeLinkRequest,
  InformatieObjectType,
  OpenZaakService,
  ZaakType,
  ZaakTypeLink,
} from '@valtimo/resource';
import {ButtonModule, IconModule, IconService, NotificationModule} from 'carbon-components-angular';
import {ToastrService} from 'ngx-toastr';
import {BehaviorSubject, switchMap} from 'rxjs';

import {ZakenApiZaaktypeLinkService} from '../../services';

@Component({
  selector: 'valtimo-zaken-api-zaaktype-link',
  templateUrl: './zaken-api-zaaktype-link.component.html',
  styleUrls: ['./zaken-api-zaaktype-link.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ModalModule,
    NotificationModule,
    TranslateModule,
    ButtonModule,
    IconModule,
  ],
})
export class ZakenApiZaaktypeLinkComponent implements OnInit {
  public zaakTypes: ZaakType[];
  public pluginConfigurations: PluginConfiguration[];
  public zaakTypeLinkRequest: CreateZaakTypeLinkRequest;
  public informatieObjectTypeSelectionEnabled: boolean;
  public informatieObjectTypes: InformatieObjectType[];
  public selectedZaakType: ZaakType | null = null;
  public selectedPluginConfiguration: PluginConfiguration | null = null;
  public selectedInformatieObjectTypeUrl: string | null = null;
  private _caseDefinitionKey: string;
  private _caseVersionTag: string;

  public readonly loading$ = new BehaviorSubject<boolean>(true);
  public readonly zaakTypeLink$ = new BehaviorSubject<ZaakTypeLink | null>(null);

  @ViewChild('openZaakTypeLinkModal') modal: ModalComponent;

  constructor(
    private readonly alertService: AlertService,
    private readonly configService: ConfigService,
    private readonly iconService: IconService,
    private readonly openZaakService: OpenZaakService,
    private readonly route: ActivatedRoute,
    private readonly toasterService: ToastrService,
    private readonly translateService: TranslateService,
    private readonly zakenApiZaaktypeLinkService: ZakenApiZaaktypeLinkService
  ) {
    this.iconService.registerAll([Edit16, TrashCan16]);
    this.informatieObjectTypeSelectionEnabled =
      this.configService.config.uploadProvider === UploadProvider.OPEN_ZAAK;
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

  public openModal(zaakTypeLink: ZaakTypeLink): void {
    this.zaakTypeLinkRequest = {
      caseDefinitionKey: this._caseDefinitionKey,
      caseVersionTag: this._caseVersionTag,
      createWithDossier: zaakTypeLink?.createWithDossier,
      rsin: zaakTypeLink?.rsin,
      zakenApiPluginConfigurationId: zaakTypeLink?.zakenApiPluginConfigurationId,
      zaakTypeUrl: zaakTypeLink?.zaakTypeUrl,
    };
    if (this.informatieObjectTypeSelectionEnabled) {
      this.openZaakService.getOpenZaakConfig().subscribe(config => {
        if (config === null) {
          this.alertService.error(this.translateService.instant('openZaak.error.configNotFound'));
        } else {
          this.loadInformatieObjectTypeUrls();
        }
        this.modal.show();
      });
    } else {
      this.modal.show();
    }
  }

  public removeZaakTypeLink(): void {
    this.openZaakService
      .deleteZaakTypeLink(this._caseDefinitionKey, this._caseVersionTag)
      .subscribe({
        next: () => {
          this.toasterService.success('Successfully de-linked zaaktype');
          this.zaakTypeLink$.next(null);
        },
        error: () => {
          this.toasterService.error('Failed to de-link zaaktype');
        },
      });
  }

  public submit(): void {
    const requestInformatieObjectTypeLink: CreateInformatieObjectTypeLinkRequest = {
      documentDefinitionName: this._caseDefinitionKey,
      zaakType: this.zaakTypeLinkRequest.zaakTypeUrl ?? '',
      informatieObjectType: this.selectedInformatieObjectTypeUrl ?? '',
    };
    this.openZaakService.createZaakTypeLink(this.zaakTypeLinkRequest).subscribe({
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
        this.toasterService.success('Successfully linked zaaktype to case');
      },
      error: () => {
        this.toasterService.error('Failed to link zaaktype to case');
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
