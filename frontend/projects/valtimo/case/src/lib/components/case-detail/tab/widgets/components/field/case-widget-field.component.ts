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
import {ChangeDetectionStrategy, Component, Input} from '@angular/core';
import {TranslateModule} from '@ngx-translate/core';
import {CarbonListModule, EllipsisPipe} from '@valtimo/components';
import {ButtonModule, InputModule} from 'carbon-components-angular';
import {BehaviorSubject} from 'rxjs';
import {WidgetsService} from '../../widgets.service';
import {PermissionService} from '@valtimo/access-control';
import {WidgetProcess} from '../widget-process/widget-process';
import {DocumentService} from '@valtimo/document';
import {FieldsWidget, WidgetAction, WidgetFieldComponent} from '@valtimo/layout';

@Component({
  selector: 'valtimo-case-widget-field',
  templateUrl: './case-widget-field.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    CommonModule,
    InputModule,
    TranslateModule,
    CarbonListModule,
    EllipsisPipe,
    ButtonModule,
    WidgetFieldComponent,
  ],
})
export class CaseWidgetFieldComponent extends WidgetProcess {
  @Input({required: true}) public set documentId(value: string) {
    this.baseDocumentId = value;
  }

  @Input() collapseVertically = false;

  @Input() public set widgetConfiguration(value: FieldsWidget) {
    if (!value) return;
    this.widgetConfiguration$.next(value);
    this.baseWidgetConfiguration = value;
  }

  @Input() public set widgetData(value: object) {
    if (!value) return;
    this.widgetData$.next(value);
  }

  public readonly widgetConfiguration$ = new BehaviorSubject<FieldsWidget | null>(null);
  public readonly widgetData$ = new BehaviorSubject<object | null>(null);

  constructor(
    protected readonly documentService: DocumentService,
    protected readonly permissionService: PermissionService,
    private readonly widgetsService: WidgetsService
  ) {
    super(documentService, permissionService);
  }

  public onProcessStartClick(process: WidgetAction): void {
    this.widgetsService.startProcess(process.processDefinitionKey);
  }
}
