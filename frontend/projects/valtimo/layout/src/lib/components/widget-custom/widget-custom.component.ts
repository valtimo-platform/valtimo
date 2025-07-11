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
import {BehaviorSubject, combineLatest, filter, Observable, Subscription} from 'rxjs';
import {CarbonListModule} from '@valtimo/components';
import {TranslateModule} from '@ngx-translate/core';
import {DocumentService} from '@valtimo/document';
import {PermissionService} from '@valtimo/access-control';
import {ButtonModule} from 'carbon-components-angular';
import {CustomWidget, CustomWidgetConfig} from '../../models';
import {CUSTOM_WIDGET_TOKEN} from '../../constants';
import {WidgetLayoutService} from '../../services';

@Component({
  selector: 'valtimo-widget-custom',
  templateUrl: './widget-custom.component.html',
  styleUrls: ['./widget-custom.component.scss'],
  standalone: true,
  imports: [CommonModule, CarbonListModule, TranslateModule, ButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WidgetCustomComponent implements AfterViewInit, OnDestroy {
  @ViewChild('customWidgetContainer', {read: ViewContainerRef})
  private readonly _customWidgetContainerRef: ViewContainerRef;

  @Input() public set widgetConfiguration(value: CustomWidget) {
    if (!value) return;
    this._widgetConfigSubject$.next(value);
  }

  @Input() public set widgetUuid(value: string) {
    this.widgetLayoutService.setWidgetDataLoaded(value);
  }

  private readonly _customWidgetConfig$ = new BehaviorSubject<CustomWidgetConfig | {}>({});

  private readonly _widgetConfigSubject$ = new BehaviorSubject<CustomWidget | null>(null);

  public get widgetConfig$(): Observable<CustomWidget> {
    return this._widgetConfigSubject$.pipe(filter(config => config !== null));
  }

  public readonly noCustomComponentAvailable = signal(false);

  private readonly _subscriptions = new Subscription();

  constructor(
    @Optional()
    @Inject(CUSTOM_WIDGET_TOKEN)
    private readonly customWidgetConfig: CustomWidgetConfig,
    private readonly cdr: ChangeDetectorRef,
    private readonly widgetLayoutService: WidgetLayoutService,
    protected readonly documentService: DocumentService,
    protected readonly permissionService: PermissionService
  ) {
    if (customWidgetConfig) this._customWidgetConfig$.next(this.customWidgetConfig);
  }

  public ngAfterViewInit(): void {
    this.openCustomWidgetSubscription();
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  private openCustomWidgetSubscription(): void {
    this._subscriptions.add(
      combineLatest([this.widgetConfig$, this._customWidgetConfig$]).subscribe(
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
