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
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  HostBinding,
  Input,
  OnDestroy,
  Output,
  signal,
  ViewChild,
  ViewEncapsulation,
} from '@angular/core';
import {TranslateModule} from '@ngx-translate/core';
import {
  CarbonListModule,
  EllipsisPipe,
  MdiIconViewerComponent,
  RenderInBodyComponent,
  ViewContentService,
  ViewType,
} from '@valtimo/components';
import {ArrowRight16} from '@carbon/icons';
import {
  ButtonModule,
  IconModule,
  IconService,
  InputModule,
  LayerModule,
  ModalModule,
  SkeletonModule,
} from 'carbon-components-angular';
import {BehaviorSubject, combineLatest, map, Observable, tap} from 'rxjs';
import {FieldsWidget} from '../../models';
import {WidgetTextDisplayType} from '../../models/widget-display.model';
import {WidgetActionButtonComponent} from '../widget-action-button/widget-action-button.component';

@Component({
  selector: 'valtimo-widget-field',
  templateUrl: './widget-field.component.html',
  styleUrls: ['./widget-field.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  standalone: true,
  imports: [
    CommonModule,
    InputModule,
    TranslateModule,
    CarbonListModule,
    EllipsisPipe,
    ButtonModule,
    WidgetActionButtonComponent,
    MdiIconViewerComponent,
    IconModule,
    LayerModule,
    ModalModule,
    RenderInBodyComponent,
    SkeletonModule,
  ],
})
export class WidgetFieldComponent implements AfterViewInit, OnDestroy {
  @HostBinding('class') public hostClasses = 'valtimo-widget-field';

  @ViewChild('widgetField') private _widgetFieldRef: ElementRef<HTMLDivElement>;

  @Input() public set widgetConfiguration(value: FieldsWidget) {
    if (!value) return;
    this.widgetConfiguration$.next(value);
    this.hostClasses = `valtimo-widget-field ${value.isCompact ? 'valtimo-widget-field--compact' : ''}`;
  }
  public readonly isEmptyWidgetData$ = new BehaviorSubject<boolean>(false);
  public readonly noVisibleFields$ = new BehaviorSubject<boolean>(true);

  @Input() public set widgetData(value: object) {
    if (!value) return;
    this.widgetData$.next(value);
    this.isEmptyWidgetData$.next(this.checkEmptyWidgetData(value));
  }

  @Output() public readonly noVisibleFieldsEvent = new EventEmitter<boolean>();

  public readonly renderVertically = signal(0);
  public readonly widgetConfiguration$ = new BehaviorSubject<FieldsWidget | null>(null);
  public readonly widgetData$ = new BehaviorSubject<object | null>(null);

  public readonly widgetPropertyValue$: Observable<
    {
      title: string;
      value: string | null;
      ellipsisCharacterLimit: number | null;
      hideWhenEmpty: boolean | false;
      isRawValue: boolean | false;
      showInPopup: boolean;
    }[][]
  > = combineLatest([this.widgetConfiguration$, this.widgetData$]).pipe(
    map(([widget, widgetData]) =>
      widget?.properties.columns.map(column =>
        column.reduce(
          (columnFields, property) => [
            ...columnFields,
            ...(widgetData === null || widgetData?.hasOwnProperty(property.key)
              ? [
                  {
                    title: property.title,
                    ellipsisCharacterLimit:
                      (property.displayProperties as WidgetTextDisplayType)
                        ?.ellipsisCharacterLimit ?? null,
                    hideWhenEmpty: widgetData
                      ? ((property.displayProperties as WidgetTextDisplayType)?.hideWhenEmpty ??
                        false)
                      : false,
                    value: widgetData
                      ? this.viewContentService.get(widgetData[property.key], {
                          ...property.displayProperties,
                          viewType: property.displayProperties?.type ?? ViewType.TEXT,
                        })
                      : null,
                    isRawValue: this.viewContentService.isRawValue({
                      ...property.displayProperties,
                      viewType: property.displayProperties?.type ?? ViewType.TEXT,
                    }),
                    showInPopup: property.showInPopup ?? false,
                  },
                ]
              : []),
          ],
          []
        )
      )
    )
  );

  public readonly mainWidgetPropertyValue$ = this.widgetPropertyValue$.pipe(
    map(columns =>
      columns
        ?.map(column => column.filter(field => !field.showInPopup))
        .filter(column => column.length > 0)
    ),
    tap(columns => this.checkEmptyFields(columns ?? []))
  );

  public readonly hasPopupFields$ = this.widgetPropertyValue$.pipe(
    map(columns => columns?.some(column => column.some(field => field.showInPopup)) ?? false)
  );

  public readonly popupFieldColumns$ = this.widgetPropertyValue$.pipe(
    map(columns => {
      const allFields = columns?.flatMap(column => column) ?? [];
      const mid = Math.ceil(allFields.length / 2);
      return allFields.length > 0 ? [allFields.slice(0, mid), allFields.slice(mid)] : [];
    })
  );

  public readonly popupModalOpen = signal(false);

  private _observer!: ResizeObserver;

  constructor(
    private readonly iconService: IconService,
    private readonly viewContentService: ViewContentService
  ) {
    this.iconService.register(ArrowRight16);
  }

  public ngAfterViewInit(): void {
    if (this._widgetFieldRef) this.openWidthObserver();
  }
  public ngOnDestroy(): void {
    this._observer?.disconnect();
  }

  private openWidthObserver(): void {
    this._observer = new ResizeObserver(event => {
      this.observerMutation(event);
    });
    this._observer.observe(this._widgetFieldRef.nativeElement);
  }

  private observerMutation(event: Array<ResizeObserverEntry>): void {
    const elementWidth = event[0]?.borderBoxSize[0]?.inlineSize;

    if (typeof elementWidth === 'number' && elementWidth !== 0) {
      if (elementWidth < 640) {
        this.renderVertically.set(1);
      } else if (elementWidth > 640 && elementWidth <= 768) {
        this.renderVertically.set(2);
      } else if (elementWidth > 768 && elementWidth <= 1080) {
        this.renderVertically.set(3);
      } else if (elementWidth > 1080) {
        this.renderVertically.set(4);
      }
    }
  }

  private checkEmptyWidgetData(widgetData: Object): boolean {
    return widgetData && Object.keys(widgetData).length === 0;
  }

  private checkEmptyFields(columns: any[][]): void {
    columns.forEach(column => {
      column.forEach(field => {
        if (
          !field?.hideWhenEmpty ||
          (field?.hideWhenEmpty && field?.value && field?.value !== '-')
        ) {
          this.noVisibleFields$.next(false);
        }

        this.noVisibleFieldsEvent.emit(this.noVisibleFields$.getValue());
      });
    });
  }
}
