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
  Inject,
  OnDestroy,
  OnInit,
  Optional,
  Type,
  ViewChild,
  ViewContainerRef,
} from '@angular/core';
import {
  ConfigService,
  UploadProvider,
  ValtimoConfig,
  ZGW_DOCUMENTEN_API_DOCUMENTS_COMPONENT_TOKEN,
} from '@valtimo/config';
import {BehaviorSubject, Subscription} from 'rxjs';
import {DossierDetailTabNotFoundComponent} from '../not-found/not-found.component';

@Component({
  selector: 'valtimo-dossier-detail-tab-documents',
  templateUrl: './documents.component.html',
})
export class DossierDetailTabDocumentsComponent implements OnInit, AfterViewInit, OnDestroy {
  @HostBinding('class.tab--no-margin') noMargin = false;
  @HostBinding('class.tab--no-min-height') noMinHeight = false;

  @ViewChild('externalDocumentsTab', {read: ViewContainerRef})
  private _externalDocumentsTab: ViewContainerRef;

  public readonly openZaakUploadProvider$ = new BehaviorSubject<boolean>(false);
  public readonly s3UploadProvider$ = new BehaviorSubject<boolean>(false);
  public readonly documentenApiUploadProvider$ = new BehaviorSubject<boolean>(false);

  private readonly _subscriptions = new Subscription();

  constructor(
    private readonly configService: ConfigService,
    @Optional()
    @Inject(ZGW_DOCUMENTEN_API_DOCUMENTS_COMPONENT_TOKEN)
    private readonly zgwDocumentenApiDocumentsComponent: Type<any>
  ) {}

  public ngOnInit(): void {
    this.setConfig(this.configService.config);
  }

  public ngAfterViewInit(): void {
    this._subscriptions.add(
      this.documentenApiUploadProvider$.subscribe(uploadProviderIsDocumentenApi => {
        this.noMargin = uploadProviderIsDocumentenApi;
        this.noMinHeight = uploadProviderIsDocumentenApi;

        if (!uploadProviderIsDocumentenApi) return;

        this._externalDocumentsTab.createComponent(
          this.zgwDocumentenApiDocumentsComponent || DossierDetailTabNotFoundComponent
        );
      })
    );
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  private setConfig(config: ValtimoConfig): void {
    const uploadProvider = config.uploadProvider;
    this.openZaakUploadProvider$.next(uploadProvider === UploadProvider.OPEN_ZAAK);
    this.s3UploadProvider$.next(config.uploadProvider === UploadProvider.S3);
    this.documentenApiUploadProvider$.next(uploadProvider === UploadProvider.DOCUMENTEN_API);
  }
}
