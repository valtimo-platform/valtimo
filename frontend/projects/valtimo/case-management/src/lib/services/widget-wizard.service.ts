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

import {computed, Injectable, Signal, signal, WritableSignal} from '@angular/core';
import {
  BasicCaseWidget,
  CaseWidgetAction,
  CaseWidgetType,
  CaseWidgetWidth,
  WidgetContentProperties,
} from '@valtimo/case';
import {WidgetStyle, WidgetTypeSelection} from '../models';

@Injectable({
  providedIn: 'root',
})
export class WidgetWizardService {
  public readonly selectedWidget: WritableSignal<WidgetTypeSelection | null> = signal(null);

  public readonly widgetWidth: WritableSignal<CaseWidgetWidth | null> = signal(null);

  public readonly widgetStyle: WritableSignal<WidgetStyle | null> = signal(null);

  public readonly widgetContent: WritableSignal<WidgetContentProperties | null> = signal(null);

  public readonly widgetTitle: WritableSignal<string | null> = signal(null);

  public readonly widgetKey: WritableSignal<string | null> = signal(null);

  public readonly widgetActions: WritableSignal<CaseWidgetAction[] | undefined> = signal(undefined);

  public readonly widgetsConfig: Signal<BasicCaseWidget> = computed(() => ({
    key: this.widgetKey() ?? '',
    title: this.widgetTitle() ?? '',
    type: this.selectedWidget()?.type ?? CaseWidgetType.FIELDS,
    width: this.widgetWidth() ?? 4,
    highContrast: (this.widgetStyle() ?? WidgetStyle.DEFAULT) === WidgetStyle.HIGH_CONTRAST,
    properties: this.widgetContent() ?? ({} as any),
    actions: this.widgetActions() ?? [],
  }));

  public readonly editMode: WritableSignal<boolean> = signal(false);

  public resetWizard(): void {
    this.selectedWidget.set(null);
    this.widgetWidth.set(null);
    this.widgetStyle.set(null);
    this.widgetContent.set(null);
    this.widgetTitle.set(null);
    this.widgetKey.set(null);
    this.widgetActions.set(undefined);
    this.editMode.set(false);
  }
}
