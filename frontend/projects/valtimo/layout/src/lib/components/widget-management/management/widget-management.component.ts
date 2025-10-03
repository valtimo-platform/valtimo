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
import {ChangeDetectionStrategy, Component, Inject, Input, signal} from '@angular/core';
import {TranslateModule} from '@ngx-translate/core';
import {TabsModule} from 'carbon-components-angular';
import {WIDGET_MANAGEMENT_SERVICE} from '../../../constants';
import {IWidgetManagementService} from '../../../interfaces';
import {WidgetManagementEditorComponent} from '../management-editor/widget-management-editor.component';
import {map, Observable, take} from 'rxjs';
import {BasicWidget, WidgetManagementTab, WidgetType} from '../../../models';
import {EditorModel, JsonEditorComponent} from '@valtimo/components';

@Component({
  selector: 'valtimo-widget-management',
  templateUrl: './widget-management.component.html',
  styleUrl: './widget-management.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    CommonModule,
    WidgetManagementEditorComponent,
    TabsModule,
    TranslateModule,
    JsonEditorComponent,
  ],
})
export class WidgetManagementComponent {
  @Input() public set params(value: any) {
    if (!value) return;
    this.widgetManagementService.initParams(value);
  }
  @Input() availableWidgetTypes: WidgetType[];
  @Input() public disableWidthStep = false;
  @Input() public disableDuplicate = false;
  @Input() public singleWidget = false;
  @Input() public disableJsonEditor = false;
  @Input() public defaultAmountOfColumns!: number;

  public readonly jsonModel$: Observable<EditorModel> = this.widgetManagementService
    .getWidgetConfiguration()
    .pipe(
      map((widgets: BasicWidget[]) => ({
        value: JSON.stringify(widgets),
        language: 'json',
      }))
    );

  public readonly $activeTab = signal<WidgetManagementTab>(WidgetManagementTab.VISUAL);
  public readonly WidgetManagementTab = WidgetManagementTab;

  constructor(
    @Inject(WIDGET_MANAGEMENT_SERVICE)
    private widgetManagementService: IWidgetManagementService<any>
  ) {}

  public onSaveEvent(widgets: BasicWidget[]): void {
    this.widgetManagementService.updateWidgetConfiguration(widgets).pipe(take(1)).subscribe();
  }

  public switchTab(tab: WidgetManagementTab): void {
    this.$activeTab.set(tab);
  }
}
