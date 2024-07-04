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

import {Component, OnInit, ViewChild} from '@angular/core';
import {
  CreateInformatieObjectTypeLinkRequest,
  CreateZaakTypeLinkRequest,
  InformatieObjectType,
  OpenZaakService,
  ZaakType,
  ZaakTypeLink,
} from '@valtimo/resource';
import {FormsModule} from '@angular/forms';
import {ActivatedRoute} from '@angular/router';
import {AlertService, ModalComponent, ModalModule} from '@valtimo/components';
import {ToastrService} from 'ngx-toastr';
import {TranslateModule, TranslateService} from '@ngx-translate/core';
import {BehaviorSubject, map, Observable} from 'rxjs';
import {ConfigService, UploadProvider} from '@valtimo/config';
import {PluginConfiguration} from '@valtimo/plugin';
import {CommonModule} from '@angular/common';
import {NotificationModule} from 'carbon-components-angular';
import {ZakenApiZaaktypeLinkService} from '../../services';

@Component({
  selector: 'valtimo-zaken-api-zaaktype-link',
  templateUrl: './zaken-api-zaaktype-link.component.html',
  styleUrls: ['./zaken-api-zaaktype-link.component.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, ModalModule, NotificationModule, TranslateModule],
})
export class ZakenApiZaaktypeLinkComponent implements OnInit {
  public zaakTypes: ZaakType[];
  public pluginConfigurations: PluginConfiguration[];
  public zaakTypeLinkRequest: CreateZaakTypeLinkRequest;
  public informatieObjectTypeSelectionEnabled: boolean;
  public informatieObjectTypes: InformatieObjectType[];
  public selectedZaakType: ZaakType = null;
  public selectedPluginConfiguration: PluginConfiguration = null;
  public selectedInformatieObjectTypeUrl: string = null;
  private readonly documentDefinitionName: string;

  readonly loading$ = new BehaviorSubject<boolean>(true);
  readonly zaakTypeLink$ = new BehaviorSubject<ZaakTypeLink>(null);

  readonly documentDefinitionName$: Observable<string> = this.route.params.pipe(
    map(params => params.name || '')
  );

  @ViewChild('openZaakTypeLinkModal') modal: ModalComponent;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly openZaakService: OpenZaakService,
    private readonly alertService: AlertService,
    private readonly toasterService: ToastrService,
    private readonly translateService: TranslateService,
    private readonly zakenApiZaaktypeLinkService: ZakenApiZaaktypeLinkService,
    private readonly configService: ConfigService
  ) {
    this.documentDefinitionName = this.route.snapshot.paramMap.get('name');
    this.informatieObjectTypeSelectionEnabled =
      this.configService.config.uploadProvider === UploadProvider.OPEN_ZAAK;
  }

  public ngOnInit(): void {
    this.zaakTypeLinkRequest = {
      documentDefinitionName: this.documentDefinitionName,
      createWithDossier: false,
    };
    this.openZaakService.getZaakTypeLink(this.documentDefinitionName).subscribe(zaakTypeLink => {
      if (zaakTypeLink !== null) {
        this.zaakTypeLinkRequest = {
          documentDefinitionName: this.documentDefinitionName,
          createWithDossier: zaakTypeLink?.createWithDossier,
          rsin: zaakTypeLink?.rsin,
          zakenApiPluginConfigurationId: zaakTypeLink?.zakenApiPluginConfigurationId,
          zaakTypeUrl: zaakTypeLink?.zaakTypeUrl,
        };
      }
      this.zaakTypeLink$.next(zaakTypeLink);
      this.loadZaakTypes();
      this.loadZakenApiPluginConfigurations();
    });
    this.loading$.next(false);
  }

  private findZaakType(zaakTypeUrl: string) {
    this.selectedZaakType = this.zaakTypes.find(zaakType => zaakType.url === zaakTypeUrl);
  }

  private findPluginConfiguration(pluginConfigurationId: string) {
    this.selectedPluginConfiguration = this.pluginConfigurations.find(
      pluginConfiguration => pluginConfiguration.id === pluginConfigurationId
    );
  }

  loadZaakTypes() {
    return this.openZaakService.getZaakTypes().subscribe((zaakTypes: ZaakType[]) => {
      this.zaakTypes = zaakTypes;
      this.findZaakType(this.zaakTypeLink$.getValue()?.zaakTypeUrl);
      this.loading$.next(false);
    });
  }

  loadZakenApiPluginConfigurations() {
    return this.zakenApiZaaktypeLinkService
      .getPluginConfigurationsByPluginDefinitionKey('zakenapi')
      .subscribe((plugins: PluginConfiguration[]) => {
        this.pluginConfigurations = plugins;
        this.findPluginConfiguration(this.zaakTypeLink$.getValue()?.zakenApiPluginConfigurationId);
      });
  }

  loadInformatieObjectTypeUrls() {
    this.openZaakService
      .getInformatieObjectTypes()
      .subscribe((informatieObjectTypes: InformatieObjectType[]) => {
        this.informatieObjectTypes = informatieObjectTypes;
      });
  }

  openModal(zaakTypeLink: ZaakTypeLink) {
    this.zaakTypeLinkRequest = {
      documentDefinitionName: this.documentDefinitionName,
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
          this.openZaakService
            .getInformatieObjectTypeLink(this.documentDefinitionName)
            .subscribe(informatieObjectTypeLink => {
              if (informatieObjectTypeLink !== null) {
                this.selectedInformatieObjectTypeUrl =
                  informatieObjectTypeLink.informatieObjectType;
              }
            });
        }
        this.modal.show();
      });
    } else {
      this.modal.show();
    }
  }

  removeZaakTypeLink() {
    this.openZaakService.deleteZaakTypeLink(this.documentDefinitionName).subscribe(
      () => {
        if (this.selectedInformatieObjectTypeUrl !== null) {
          this.openZaakService.deleteInformatieObjectTypeLink(this.documentDefinitionName);
        }
        this.toasterService.success('Successfully de-linked zaaktype');
        this.zaakTypeLink$.next(null);
      },
      () => {
        this.toasterService.error('Failed to de-link zaaktype');
      }
    );
  }

  submit() {
    const requestInformatieObjectTypeLink: CreateInformatieObjectTypeLinkRequest = {
      documentDefinitionName: this.documentDefinitionName,
      zaakType: this.zaakTypeLinkRequest.zaakTypeUrl,
      informatieObjectType: this.selectedInformatieObjectTypeUrl,
    };
    this.openZaakService.createZaakTypeLink(this.zaakTypeLinkRequest).subscribe(
      linkResult => {
        this.zaakTypeLink$.next(linkResult);
        this.zaakTypeLinkRequest = {
          documentDefinitionName: this.documentDefinitionName,
          createWithDossier: linkResult?.createWithDossier,
          rsin: linkResult?.rsin,
          zakenApiPluginConfigurationId: linkResult?.zakenApiPluginConfigurationId,
          zaakTypeUrl: linkResult?.zaakTypeUrl,
        };
        this.findZaakType(linkResult.zaakTypeUrl);
        this.findPluginConfiguration(linkResult.zakenApiPluginConfigurationId);
        if (requestInformatieObjectTypeLink.informatieObjectType !== null) {
          this.openZaakService
            .createInformatieObjectTypeLink(requestInformatieObjectTypeLink)
            .subscribe(() => {
              this.toasterService.success('Successfully linked object informatie type to dossier');
            });
        }
        this.toasterService.success('Successfully linked zaaktype to dossier');
      },
      err => {
        this.toasterService.error('Failed to link zaaktype to dossier');
      }
    );
  }
}
