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

import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
} from '@angular/core';

import {DomSanitizer, SafeResourceUrl} from '@angular/platform-browser';
import {BehaviorSubject, Observable, Subscription} from 'rxjs';
import {
  ButtonModule,
  IconModule,
  LayerModule,
  LoadingModule,
  ModalModule,
  ToggleModule,
  ToggletipModule,
} from 'carbon-components-angular';
import {TranslateModule} from '@ngx-translate/core';
import {CommonModule} from '@angular/common';
import {ConfigService} from '@valtimo/shared';
import {DocumentenApiRelatedFile} from '../../models';
import {HttpClient} from '@angular/common/http';
import {DownloadService} from '@valtimo/resource';
import {take} from 'rxjs/operators';

@Component({
  selector: 'valtimo-documenten-api-preview-modal',
  templateUrl: './documenten-api-preview-modal.component.html',
  styleUrls: ['./documenten-api-preview-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    CommonModule,
    ModalModule,
    TranslateModule,
    ButtonModule,
    ToggleModule,
    LayerModule,
    LoadingModule,
    IconModule,
    ToggletipModule,
  ],
})
export class DocumentenApiPreviewModalComponent implements OnInit, OnDestroy {
  @Input() public caseDefinitionKey!: string;
  @Input() public showModalSubject$: Observable<boolean>;
  @Input() public relatedFile$: Observable<DocumentenApiRelatedFile>;
  @Output() public modalClose = new EventEmitter();

  public readonly loading$ = new BehaviorSubject<boolean>(true);
  public readonly modalOpen$ = new BehaviorSubject<boolean>(false);
  public pdfSrc: SafeResourceUrl;
  public fileName: string | undefined;

  private readonly _valtimoEndpointUri!: string;
  private readonly _subscriptions: Subscription[] = [];

  constructor(
    configService: ConfigService,
    private readonly downloadService: DownloadService,
    private readonly sanitizer: DomSanitizer,
    private readonly http: HttpClient
  ) {
    this._valtimoEndpointUri = configService.config.valtimoApi.endpointUri;
  }

  public ngOnInit() {
    if (this.showModalSubject$) {
      this._subscriptions.push(
        this.showModalSubject$.subscribe(showModal => {
          this.modalOpen$.next(showModal);
        })
      );
    }

    this.setPdfSrc();
  }

  private setPdfSrc(): void {
    this._subscriptions.push(
      this.relatedFile$.subscribe(document => {
        if (!document) {
          return;
        }

        this.fileName = document.bestandsnaam;

        let pdfUri: string = `${this._valtimoEndpointUri}v1/documenten-api-preview/${document.pluginConfigurationId}/preview/${document.fileId}`;

        this.loading$.next(true);
        this.http
          .get(pdfUri.toString(), {
            responseType: 'blob',
          })
          .subscribe(blob => {
            this.pdfSrc = this.sanitizer.bypassSecurityTrustResourceUrl(URL.createObjectURL(blob));
            this.loading$.next(false);
          });
      })
    );
  }

  public ngOnDestroy(): void {
    this._subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  public onClose(): void {
    this.close();
  }

  private close(): void {
    this.modalOpen$.next(false);
    this.modalClose.emit();
  }

  public onDownload(): void {
    this.relatedFile$.pipe(take(1)).subscribe(document => {
      this.downloadService.downloadFile(
        `${this._valtimoEndpointUri}v1/zaken-api/${document.pluginConfigurationId}/case-document/${document.fileId}/files/${document.fileId}/download`,
        document.bestandsnaam ?? '',
        true
      );
    });
  }
}
