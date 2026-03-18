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
  Output,
} from '@angular/core';

import {Subscription} from 'rxjs';
import {ButtonModule, LayerModule, ModalModule, ToggleModule} from 'carbon-components-angular';
import {TranslateModule} from '@ngx-translate/core';
import {CommonModule} from '@angular/common';
import {PdfViewerModule} from 'ng2-pdf-viewer';

@Component({
  selector: 'valtimo-documenten-api-preview-modal',
  templateUrl: './documenten-api-preview-modal.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    CommonModule,
    ModalModule,
    TranslateModule,
    PdfViewerModule,
    ButtonModule,
    ToggleModule,
    LayerModule,
  ],
})
export class DocumentenApiPreviewModalComponent implements OnDestroy {
  @Input() public caseDefinitionKey!: string;
  @Input() public open = false;

  @Output() public modalClose = new EventEmitter();

  private readonly _subscriptions = new Subscription();

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  public onClose(): void {
    this.close();
  }

  private close(): void {
    this.modalClose.emit();
  }
}
