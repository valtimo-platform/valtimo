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

import {ChangeDetectionStrategy, Component, Input} from '@angular/core';
import {CommonModule} from '@angular/common';
import {BehaviorSubject, filter, Observable} from 'rxjs';
import {CarbonListModule} from '@valtimo/components';
import {TranslateModule} from '@ngx-translate/core';
import {DocumentService} from '@valtimo/document';
import {PermissionService} from '@valtimo/access-control';
import {ButtonModule} from 'carbon-components-angular';
import {WidgetProcess} from '../widget-process/widget-process';
import {WidgetsService} from '../../widgets.service';
import {CustomWidget, WidgetAction, WidgetCustomComponent} from '@valtimo/layout';

@Component({
  selector: 'valtimo-case-widget-custom',
  templateUrl: './case-widget-custom.component.html',
  standalone: true,
  imports: [CommonModule, CarbonListModule, TranslateModule, ButtonModule, WidgetCustomComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CaseWidgetCustomComponent extends WidgetProcess {
  @Input({required: true}) public set documentId(value: string) {
    this.baseDocumentId = value;
  }
  @Input() public set widgetConfiguration(value: CustomWidget) {
    if (!value) return;
    this.baseWidgetConfiguration = value;
    this._widgetConfigSubject$.next(value);
  }
  @Input() public readonly widgetUuid: string;

  private readonly _widgetConfigSubject$ = new BehaviorSubject<CustomWidget | null>(null);

  public get widgetConfig$(): Observable<CustomWidget> {
    return this._widgetConfigSubject$.pipe(filter(config => config !== null));
  }

  constructor(
    private readonly widgetsService: WidgetsService,
    protected readonly documentService: DocumentService,
    protected readonly permissionService: PermissionService
  ) {
    super(documentService, permissionService);
  }

  public onProcessStartClick(process: WidgetAction): void {
    this.widgetsService.startProcess(process.processDefinitionKey);
  }
}
