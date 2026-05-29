/*
 * Copyright 2015-2026 Ritense BV, the Netherlands.
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
import {CommonModule, DatePipe} from '@angular/common';
import {ChangeDetectionStrategy, Component, HostBinding, Input, ViewEncapsulation} from '@angular/core';
import {Information16} from '@carbon/icons';
import {TranslateModule} from '@ngx-translate/core';
import {
  CarbonListModule,
  MdiIconViewerComponent,
  RemoveClassnamesDirective,
} from '@valtimo/components';
import {
  IconModule,
  IconService,
  SkeletonModule,
  ToggletipModule,
} from 'carbon-components-angular';
import {BehaviorSubject, combineLatest, map, Observable} from 'rxjs';
import {
  METROLINE_SKELETON_STEP_COUNT,
  METROLINE_STEP_ICONS,
  METROLINE_STEP_STATE_TRANSLATION_KEYS,
} from '../../constants';
import {
  MetrolineItem,
  MetrolineMode,
  MetrolineOrientation,
  MetrolineStep,
  MetrolineStepState,
  MetrolineWidget,
} from '../../models';
import {WidgetActionButtonComponent} from '../widget-action-button/widget-action-button.component';

interface MetrolineDisplayState {
  steps: MetrolineStep[];
  currentStepIndex: number;
}

@Component({
  selector: 'valtimo-widget-metroline',
  templateUrl: './widget-metroline.component.html',
  styleUrls: ['./widget-metroline.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  standalone: true,
  imports: [
    CarbonListModule,
    CommonModule,
    IconModule,
    MdiIconViewerComponent,
    RemoveClassnamesDirective,
    SkeletonModule,
    ToggletipModule,
    TranslateModule,
    WidgetActionButtonComponent,
  ],
  providers: [DatePipe],
})
export class WidgetMetrolineComponent {
  @HostBinding('class') public readonly class = 'valtimo-widget-metroline';

  @Input() public set widgetConfiguration(value: MetrolineWidget) {
    if (!value) return;
    this.widgetConfiguration$.next(value);
  }

  @Input() public set widgetData(value: object | null) {
    this.widgetData$.next(value as MetrolineItem[] | null);
  }

  public readonly widgetConfiguration$ = new BehaviorSubject<MetrolineWidget | null>(null);
  public readonly widgetData$ = new BehaviorSubject<MetrolineItem[] | null>(null);

  public readonly orientation$: Observable<'horizontal' | 'vertical'> =
    this.widgetConfiguration$.pipe(
      map(config =>
        config?.properties?.orientation === MetrolineOrientation.VERTICAL ? 'vertical' : 'horizontal'
      )
    );

  public readonly displayState$: Observable<MetrolineDisplayState> = combineLatest([
    this.widgetData$,
    this.widgetConfiguration$,
  ]).pipe(
    map(([items, config]) => {
      const mode = config?.properties?.mode ?? MetrolineMode.INTERNAL_CASE_STATUS;
      return {
        steps: this.toSteps(items, mode),
        currentStepIndex: this.toCurrentStepIndex(items, mode),
      };
    })
  );

  public readonly isEmptyWidgetData$: Observable<boolean> = this.widgetData$.pipe(
    map(items => Array.isArray(items) && items.length === 0)
  );

  protected readonly skeletonSteps = Array.from({length: METROLINE_SKELETON_STEP_COUNT});
  protected readonly stepIcons = METROLINE_STEP_ICONS;
  protected readonly stepStateTranslationKeys = METROLINE_STEP_STATE_TRANSLATION_KEYS;

  constructor(
    private readonly datePipe: DatePipe,
    private readonly iconService: IconService
  ) {
    this.iconService.registerAll([Information16]);
  }

  public getStepState(
    step: MetrolineStep,
    index: number,
    currentIndex: number
  ): MetrolineStepState {
    if (index === currentIndex) return MetrolineStepState.CURRENT;
    if (step.invalid) return MetrolineStepState.INVALID;
    if (step.complete) return MetrolineStepState.COMPLETE;
    return MetrolineStepState.INCOMPLETE;
  }

  private toSteps(items: MetrolineItem[] | null, mode: MetrolineMode): MetrolineStep[] {
    if (!items?.length) return [];

    if (mode === MetrolineMode.ZAAKSTATUS) {
      return items.map(item => ({
        label: item.title,
        secondaryLabel: this.formatCompleted(item.completed),
        complete: item.completed != null,
        itemLabel: item.label,
      }));
    }

    const lastIndex = items.length - 1;
    return items.map((item, index) => ({
      label: item.title,
      secondaryLabel: this.formatCompleted(item.completed),
      complete: index < lastIndex,
      itemLabel: item.label,
    }));
  }

  private toCurrentStepIndex(items: MetrolineItem[] | null, mode: MetrolineMode): number {
    if (!items?.length) return 0;

    if (mode === MetrolineMode.ZAAKSTATUS) {
      const firstNotCompleted = items.findIndex(item => item.completed == null);
      return firstNotCompleted === -1 ? items.length : firstNotCompleted;
    }

    return items.length - 1;
  }

  private formatCompleted(completed: string | null): string | undefined {
    if (!completed) return undefined;
    return this.datePipe.transform(completed, 'dd-MM-yyyy HH:mm') ?? undefined;
  }
}
