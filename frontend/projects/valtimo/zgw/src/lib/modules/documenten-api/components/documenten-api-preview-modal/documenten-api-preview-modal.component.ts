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
  SecurityContext,
} from '@angular/core';

import {DomSanitizer, SafeResourceUrl, SafeUrl} from '@angular/platform-browser';
import {BehaviorSubject, Observable, Subscription, take} from 'rxjs';
import {ButtonModule, LayerModule, ModalModule, ToggleModule} from 'carbon-components-angular';
import {TranslateModule} from '@ngx-translate/core';
import {CommonModule} from '@angular/common';
import {ConfigService} from '@valtimo/shared';
import {DocumentenApiRelatedFile} from '../../models';
import {HttpClient} from '@angular/common/http';

@Component({
  selector: 'valtimo-documenten-api-preview-modal',
  templateUrl: './documenten-api-preview-modal.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [CommonModule, ModalModule, TranslateModule, ButtonModule, ToggleModule, LayerModule],
})
export class DocumentenApiPreviewModalComponent implements OnInit, OnDestroy {
  @Input() public caseDefinitionKey!: string;
  @Input() public showModalSubject$: Observable<boolean>;
  @Input() public relatedFile$: Observable<DocumentenApiRelatedFile>;
  @Output() public modalClose = new EventEmitter();

  public readonly modalOpen$ = new BehaviorSubject<boolean>(false);
  public pdfSrc: SafeResourceUrl;

  private readonly _valtimoEndpointUri!: string;
  private _showModalSubscription!: Subscription;

  constructor(
    configService: ConfigService,
    private readonly sanitizer: DomSanitizer,
    private readonly http: HttpClient
  ) {
    this._valtimoEndpointUri = configService.config.valtimoApi.endpointUri;
  }

  public ngOnInit() {
    if (this.showModalSubject$) {
      this._showModalSubscription = this.showModalSubject$.subscribe(showModal => {
        this.modalOpen$.next(showModal);
      });
    }

    this.setPdfSrc();
  }

  private setPdfSrc(): void {
    this.relatedFile$.subscribe(document => {
      if (!document) {
        return;
      }

      let pdfUri: string = `${this._valtimoEndpointUri}v1/documenten-api-preview/${document.pluginConfigurationId}/preview/${document.fileId}`;

      this.http
        .get(pdfUri.toString(), {
          responseType: 'blob',
        })
        .subscribe(blob => {
          const url = URL.createObjectURL(blob);
          this.pdfSrc = this.sanitizer.bypassSecurityTrustResourceUrl(url);

          console.log(`DEBUG: PDF is set to: ${this.pdfSrc.toString()}`);
        });
    });
  }

  public ngOnDestroy(): void {
    this._showModalSubscription.unsubscribe();
  }

  public onClose(): void {
    this.close();
  }

  private close(): void {
    this.modalOpen$.next(false);
    this.modalClose.emit();
  }
}
