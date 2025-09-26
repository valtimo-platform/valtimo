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
import {BehaviorSubject, catchError, combineLatest, Observable, of, switchMap, tap} from 'rxjs';
import {WidgetsService} from '../../widgets.service';
import {PermissionService} from '@valtimo/access-control';
import {WidgetProcess} from '../widget-process/widget-process';
import {DocumentService} from '@valtimo/document';
import {
  FieldsWidget,
  WidgetAction,
  WidgetFieldComponent,
  WidgetLayoutService,
} from '@valtimo/layout';
import {CaseTabService, CaseWidgetsApiService} from '../../../../../../services';
import {HttpErrorResponse} from '@angular/common/http';

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
  private readonly _documentId$ = new BehaviorSubject<string>('');

  @Input({required: true}) public set documentId(value: string) {
    this.baseDocumentId = value;
    this._documentId$.next(value);
  }

  @Input() public set widgetConfiguration(value: FieldsWidget) {
    if (!value) return;
    this.widgetConfiguration$.next(value);
    this.baseWidgetConfiguration = value;
  }

  @Input() public readonly widgetUuid: string;

  public readonly widgetConfiguration$ = new BehaviorSubject<FieldsWidget | null>(null);
  public readonly tabKey$: Observable<string> = this.caseTabService.activeTabKey$;

  public readonly widgetData$: Observable<any[] | {} | null> = combineLatest([
    this.widgetConfiguration$,
    this.tabKey$,
    this._documentId$,
  ]).pipe(
    switchMap(([widget, tabkey, documentId]) =>
      this.caseWidgetApiService.getWidgetData(documentId, tabkey, widget.key, undefined)
    ),
    tap(() => {
      this.widgetLayoutService.setWidgetDataLoaded(this.widgetUuid);
    }),
    catchError((error: HttpErrorResponse) => {
      if (error.status === 404) this.widgetLayoutService.setWidgetDataLoaded(this.widgetUuid);

      return of(null);
    })
  );

  constructor(
    protected readonly documentService: DocumentService,
    protected readonly permissionService: PermissionService,
    private readonly widgetsService: WidgetsService,
    private readonly caseTabService: CaseTabService,
    private readonly caseWidgetApiService: CaseWidgetsApiService,
    private readonly widgetLayoutService: WidgetLayoutService
  ) {
    super(documentService, permissionService);
  }

  public onProcessStartClick(process: WidgetAction): void {
    this.widgetsService.startProcess(process.processDefinitionKey);
  }
}
