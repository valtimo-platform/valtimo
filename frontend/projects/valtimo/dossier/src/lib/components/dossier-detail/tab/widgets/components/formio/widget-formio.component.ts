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

import {ChangeDetectionStrategy, Component, Input} from '@angular/core';
import {CommonModule} from '@angular/common';
import {TranslateModule} from '@ngx-translate/core';
import {FormioCaseWidgetWidgetWithUuid} from '../../../../../../models';
import {BehaviorSubject, combineLatest, filter, map, Observable, of, switchMap, tap} from 'rxjs';
import {FormService} from '@valtimo/form';
import {DossierWidgetsLayoutService} from '../../../../../../services';
import {FormioForm} from '@formio/angular';
import {FormIoModule} from '@valtimo/components';

@Component({
  selector: 'valtimo-widget-formio',
  templateUrl: './widget-formio.component.html',
  styleUrls: ['./widget-formio.component.scss'],
  standalone: true,
  imports: [CommonModule, TranslateModule, FormIoModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WidgetFormioComponent {
  @Input() public set documentId(value: string) {
    if (value) this._documentIdSubject$.next(value);
  }
  @Input() public set widgetConfiguration(value: FormioCaseWidgetWidgetWithUuid) {
    if (!value) return;
    this.layoutService.setWidgetWithExternalData(value.uuid);
    this._widgetConfigurationSubject$.next(value);
  }

  private readonly _widgetConfigurationSubject$ =
    new BehaviorSubject<FormioCaseWidgetWidgetWithUuid | null>(null);
  public get widgetConfiguration$(): Observable<FormioCaseWidgetWidgetWithUuid> {
    return this._widgetConfigurationSubject$.pipe(filter(config => !!config));
  }

  private readonly _documentIdSubject$ = new BehaviorSubject<string>('');
  private get _documentId$(): Observable<string> {
    return this._documentIdSubject$.pipe(filter(id => !!id));
  }

  public readonly prefilledFormDefinition$: Observable<FormioForm> = combineLatest([
    this.widgetConfiguration$,
    this._documentId$,
  ]).pipe(
    switchMap(([config, documentId]) =>
      combineLatest([
        this.formService.getFormDefinitionByNamePreFilled(
          config.properties.formDefinitionName,
          documentId
        ),
        of(config),
      ])
    ),
    tap(([_, config]) => this.layoutService.setWidgetWithExternalDataReady(config.uuid)),
    map(([formDef]) => formDef)
  );

  constructor(
    private readonly formService: FormService,
    private readonly layoutService: DossierWidgetsLayoutService
  ) {}
}
