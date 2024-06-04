import {computed, Injectable, Signal, signal, WritableSignal} from '@angular/core';
import {WidgetStyle, WidgetTypeSelection} from '../models';
import {CaseWidget, CaseWidgetType, CaseWidgetWidth} from '@valtimo/dossier';

@Injectable({
  providedIn: 'root',
})
export class WidgetWizardService {
  public readonly selectedWidget: WritableSignal<WidgetTypeSelection | null> = signal(null);

  public readonly widgetWidth: WritableSignal<CaseWidgetWidth | null> = signal(null);

  public readonly widgetStyle: WritableSignal<WidgetStyle | null> = signal(null);

  public readonly widgetContent: WritableSignal<{[columnIndex: number]: any} | null> = signal(null);

  public readonly widgetTitle: WritableSignal<string | null> = signal(null);

  public readonly widgetsConfig: Signal<CaseWidget> = computed(() => ({
    key: (this.widgetTitle() ?? '').replace(/\W+/g, '-').replace(/\-$/, '').toLowerCase(),
    title: this.widgetTitle() ?? '',
    type: this.selectedWidget()?.type ?? CaseWidgetType.FIELDS,
    width: this.widgetWidth() ?? 4,
    highContrast: (this.widgetStyle() ?? WidgetStyle.DEFAULT) === WidgetStyle.HIGH_CONTRAST,
    properties: {
      columns: Object.values(this.widgetContent() ?? {}),
    },
  }));

  public resetWizard(): void {
    this.selectedWidget.set(null);
    this.widgetWidth.set(null);
    this.widgetStyle.set(null);
    this.widgetContent.set(null);
    this.widgetTitle.set(null);
  }
}
