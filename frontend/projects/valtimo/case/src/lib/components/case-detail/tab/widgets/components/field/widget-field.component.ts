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
  HostBinding,
  Input,
  OnDestroy,
  signal,
  ViewChild,
  ViewEncapsulation,
} from '@angular/core';
import {TranslateModule} from '@ngx-translate/core';
import {CarbonListModule, EllipsisPipe, ViewContentService, ViewType} from '@valtimo/components';
import {ButtonModule, InputModule} from 'carbon-components-angular';
import {BehaviorSubject, combineLatest, map, Observable, tap} from 'rxjs';
import {
  CaseWidgetAction,
  CaseWidgetTextDisplayType,
  FieldsCaseWidget,
} from '../../../../../../models';
import {WidgetsService} from '../../widgets.service';
import {PermissionService} from '@valtimo/access-control';
import {ActivatedRoute} from '@angular/router';
import {WidgetProcess} from '../widget-process/widget-process';
import {DocumentService} from '@valtimo/document';

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
  ],
})
export class WidgetFieldComponent extends WidgetProcess implements AfterViewInit, OnDestroy {
  @HostBinding('class') public readonly class = 'widget-field';

  @ViewChild('widgetField') private _widgetFieldRef: ElementRef<HTMLDivElement>;

  @Input({required: true}) public set documentId(value: string) {
    this.baseDocumentId = value;
  }
  @Input() collapseVertically = false;
  @Input() public set widgetConfiguration(value: FieldsCaseWidget) {
    if (!value) return;
    this.widgetConfiguration$.next(value);
    this.baseWidgetConfiguration = value;
  }
  public readonly isEmptyWidgetData$ = new BehaviorSubject<boolean>(false);
  public readonly noVisibleFields$ = new BehaviorSubject<boolean>(true);

  @Input() public set widgetData(value: object) {
    if (!value) return;
    this.widgetData$.next(value);
    this.isEmptyWidgetData$.next(this.checkEmptyWidgetData(value));
  }

  public readonly renderVertically = signal(0);
  public readonly widgetConfiguration$ = new BehaviorSubject<FieldsCaseWidget | null>(null);
  public readonly widgetData$ = new BehaviorSubject<object | null>(null);

  public readonly widgetPropertyValue$: Observable<
    {
      title: string;
      value: string;
      ellipsisCharacterLimit: number | null;
      hideWhenEmpty: boolean | false;
    }[][]
  > = combineLatest([this.widgetConfiguration$, this.widgetData$]).pipe(
    map(([widget, widgetData]) =>
      widget?.properties.columns.map(column =>
        column.reduce(
          (columnFields, property) => [
            ...columnFields,
            ...(widgetData?.hasOwnProperty(property.key)
              ? [
                  {
                    title: property.title,
                    ellipsisCharacterLimit:
                      (property.displayProperties as CaseWidgetTextDisplayType)
                        ?.ellipsisCharacterLimit ?? null,
                    hideWhenEmpty:
                      (property.displayProperties as CaseWidgetTextDisplayType)?.hideWhenEmpty ??
                      false,
                    value: this.viewContentService.get(widgetData[property.key], {
                      ...property.displayProperties,
                      viewType: property.displayProperties?.type ?? ViewType.TEXT,
                    }),
                  },
                ]
              : []),
          ],
          []
        )
      )
    ),
    tap(columns => this.checkEmptyFields(columns))
  );

  private _observer!: ResizeObserver;

  constructor(
    protected readonly documentService: DocumentService,
    protected readonly permissionService: PermissionService,
    private readonly route: ActivatedRoute,
    private readonly viewContentService: ViewContentService,
    private readonly widgetsService: WidgetsService
  ) {
    super(documentService, permissionService);
  }

  public ngAfterViewInit(): void {
    if (this.collapseVertically && this._widgetFieldRef) this.openWidthObserver();
  }

  public ngOnDestroy(): void {
    this._observer?.disconnect();
  }

  public onProcessStartClick(process: CaseWidgetAction): void {
    this.widgetsService.startProcess(process.processDefinitionKey);
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
        if (!field?.hideWhenEmpty || (field?.hideWhenEmpty && field?.value && field?.value !== '-'))
          this.noVisibleFields$.next(false);
      });
    });
  }
}
