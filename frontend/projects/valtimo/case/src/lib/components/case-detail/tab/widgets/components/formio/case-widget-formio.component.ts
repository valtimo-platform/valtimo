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
import {TranslateModule} from '@ngx-translate/core';
import {BehaviorSubject, filter, Observable} from 'rxjs';
import {CaseWidgetsLayoutService} from '../../../../../../services';
import {FormIoModule} from '@valtimo/components';
import {WidgetProcess} from '../widget-process/widget-process';
import {PermissionService} from '@valtimo/access-control';
import {DocumentService} from '@valtimo/document';
import {ButtonModule} from 'carbon-components-angular';
import {WidgetsService} from '../../widgets.service';
import {FormioWidgetWidgetWithUuid, WidgetAction, WidgetFormioComponent} from '@valtimo/layout';

@Component({
  selector: 'valtimo-case-widget-formio',
  templateUrl: './case-widget-formio.component.html',
  standalone: true,
  imports: [CommonModule, TranslateModule, FormIoModule, ButtonModule, WidgetFormioComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CaseWidgetFormioComponent extends WidgetProcess {
  @Input() public set documentId(value: string) {
    if (value) this._documentIdSubject$.next(value);
    this.baseDocumentId = value;
  }
  @Input() public set widgetConfiguration(value: FormioWidgetWidgetWithUuid) {
    if (!value) return;
    this.layoutService.setWidgetWithExternalData(value.uuid);
    this.baseWidgetConfiguration = value;
    this._widgetConfigurationSubject$.next(value);
  }
  @Input() public readonly widgetUuid: string;

  private readonly _widgetConfigurationSubject$ =
    new BehaviorSubject<FormioWidgetWidgetWithUuid | null>(null);
  public get widgetConfiguration$(): Observable<FormioWidgetWidgetWithUuid> {
    return this._widgetConfigurationSubject$.pipe(filter(config => !!config));
  }

  private readonly _documentIdSubject$ = new BehaviorSubject<string>('');

  public get documentId$(): Observable<string> {
    return this._documentIdSubject$.pipe(filter(id => !!id));
  }

  constructor(
    protected readonly documentService: DocumentService,
    protected readonly permissionService: PermissionService,
    private readonly layoutService: CaseWidgetsLayoutService,
    private readonly widgetsService: WidgetsService
  ) {
    super(documentService, permissionService);
  }

  public onProcessStartClick(process: WidgetAction): void {
    this.widgetsService.startProcess(process.processDefinitionKey);
  }
}
