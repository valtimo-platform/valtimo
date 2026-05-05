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
import {I18n, IconModule, IconService, ToggletipModule} from 'carbon-components-angular';
import {BehaviorSubject, combineLatest, map, Observable} from 'rxjs';
import {
  MetrolineItem,
  MetrolineMode,
  MetrolineOrientation,
  MetrolineStep,
  MetrolineStepState,
  MetrolineWidget,
} from '../../models';
import {WidgetActionButtonComponent} from '../widget-action-button/widget-action-button.component';

const STATUS_ICONS: Record<MetrolineStepState, string> = {
  current: 'incomplete',
  complete: 'checkmark--outline',
  invalid: 'warning',
  incomplete: 'circle-dash',
};

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
    this.widgetData$.next((value as MetrolineItem[] | null) ?? null);
  }

  public readonly widgetConfiguration$ = new BehaviorSubject<MetrolineWidget | null>(null);
  public readonly widgetData$ = new BehaviorSubject<MetrolineItem[] | null>(null);

  private readonly mode$: Observable<MetrolineMode> = this.widgetConfiguration$.pipe(
    map(config => config?.properties?.mode ?? MetrolineMode.INTERNAL_CASE_STATUS)
  );

  public readonly steps$: Observable<MetrolineStep[]> = combineLatest([
    this.widgetData$,
    this.mode$,
  ]).pipe(map(([items, mode]) => this.toSteps(items, mode)));

  public readonly currentStepIndex$: Observable<number> = combineLatest([
    this.widgetData$,
    this.mode$,
  ]).pipe(map(([items, mode]) => this.toCurrentStepIndex(items, mode)));

  public readonly orientation$: Observable<'horizontal' | 'vertical'> =
    this.widgetConfiguration$.pipe(
      map(config =>
        config?.properties?.orientation === MetrolineOrientation.VERTICAL ? 'vertical' : 'horizontal'
      )
    );

  public readonly hasItems$: Observable<boolean> = this.widgetData$.pipe(
    map(items => Array.isArray(items) && items.length > 0)
  );

  public readonly hasLoaded$: Observable<boolean> = this.widgetData$.pipe(
    map(items => items !== null)
  );

  public readonly viewModel$ = combineLatest([
    this.widgetConfiguration$,
    this.widgetData$,
    this.steps$,
    this.currentStepIndex$,
    this.orientation$,
    this.hasItems$,
    this.hasLoaded$,
  ]).pipe(
    map(
      ([
        widgetConfiguration,
        widgetData,
        steps,
        currentStepIndex,
        orientation,
        hasItems,
        hasLoaded,
      ]) => ({
        widgetConfiguration,
        widgetData,
        steps,
        currentStepIndex,
        orientation,
        hasItems,
        hasLoaded,
      })
    )
  );

  constructor(
    private readonly datePipe: DatePipe,
    private readonly i18n: I18n,
    private readonly iconService: IconService
  ) {
    this.iconService.registerAll([Information16]);
  }

  public getStepState(
    step: MetrolineStep,
    index: number,
    currentIndex: number
  ): MetrolineStepState {
    if (index === currentIndex) return 'current';
    if (step.invalid) return 'invalid';
    if (step.complete) return 'complete';
    return 'incomplete';
  }

  public getStepIcon(state: MetrolineStepState): string {
    return STATUS_ICONS[state];
  }

  public getStepStateLabel(state: MetrolineStepState): string {
    const translations = this.i18n.get().PROGRESS_INDICATOR;
    const key = state.toUpperCase() as Uppercase<MetrolineStepState>;
    return translations[key];
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
