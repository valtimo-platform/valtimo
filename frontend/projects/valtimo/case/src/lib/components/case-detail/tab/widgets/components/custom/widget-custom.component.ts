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
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  Inject,
  Input,
  OnDestroy,
  Optional,
  signal,
  ViewChild,
  ViewContainerRef,
} from '@angular/core';
import {CommonModule} from '@angular/common';
import {CaseWidgetAction, CustomCaseWidget, CustomCaseWidgetConfig} from '../../../../../../models';
import {CUSTOM_CASE_WIDGET_TOKEN} from '../../../../../../constants';
import {BehaviorSubject, combineLatest, filter, Observable, Subscription} from 'rxjs';
import {CarbonListModule} from '@valtimo/components';
import {TranslateModule} from '@ngx-translate/core';
import {DocumentService} from '@valtimo/document';
import {PermissionService} from '@valtimo/access-control';
import {ButtonModule} from 'carbon-components-angular';
import {WidgetProcess} from '../widget-process/widget-process';
import {WidgetsService} from '../../widgets.service';

@Component({
  selector: 'valtimo-widget-custom',
  templateUrl: './widget-custom.component.html',
  styleUrls: ['./widget-custom.component.scss'],
  standalone: true,
  imports: [CommonModule, CarbonListModule, TranslateModule, ButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WidgetCustomComponent extends WidgetProcess implements AfterViewInit, OnDestroy {
  @ViewChild('customWidgetContainer', {read: ViewContainerRef})
  private readonly _customWidgetContainerRef: ViewContainerRef;

  @Input({required: true}) public set documentId(value: string) {
    this.baseDocumentId = value;
  }
  @Input() public set widgetConfig(value: CustomCaseWidget) {
    if (!value) return;
    this.baseWidgetConfiguration = value;
    this._widgetConfigSubject$.next(value);
  }

  private readonly _customCaseWidgetConfig$ = new BehaviorSubject<CustomCaseWidgetConfig | {}>({});

  private readonly _widgetConfigSubject$ = new BehaviorSubject<CustomCaseWidget | null>(null);

  public get widgetConfig$(): Observable<CustomCaseWidget> {
    return this._widgetConfigSubject$.pipe(filter(config => config !== null));
  }

  public readonly noCustomComponentAvailable = signal(false);

  private readonly _subscriptions = new Subscription();

  constructor(
    @Optional()
    @Inject(CUSTOM_CASE_WIDGET_TOKEN)
    private readonly customCaseWidgetConfig: CustomCaseWidgetConfig,
    private readonly cdr: ChangeDetectorRef,
    private readonly widgetsService: WidgetsService,
    protected readonly documentService: DocumentService,
    protected readonly permissionService: PermissionService
  ) {
    super(documentService, permissionService);
    if (customCaseWidgetConfig) this._customCaseWidgetConfig$.next(customCaseWidgetConfig);
  }

  public ngAfterViewInit(): void {
    this.openCustomWidgetSubscription();
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  public onProcessStartClick(process: CaseWidgetAction): void {
    this.widgetsService.startProcess(process.processDefinitionKey);
  }

  private openCustomWidgetSubscription(): void {
    this._subscriptions.add(
      combineLatest([this.widgetConfig$, this._customCaseWidgetConfig$]).subscribe(
        ([widgetConfig, customCaseWidgetConfig]) => {
          const customWidgetComponentKey = widgetConfig?.properties?.componentKey;
          const customComponent = customCaseWidgetConfig[customWidgetComponentKey];

          if (!customComponent) {
            this.noCustomComponentAvailable.set(true);
            return;
          }

          const componentRef = this._customWidgetContainerRef.createComponent(customComponent);

          componentRef.changeDetectorRef.detectChanges();
          this.cdr.detectChanges();
        }
      )
    );
  }
}
