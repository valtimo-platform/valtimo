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
  ChangeDetectorRef,
  Component,
  OnInit,
  TemplateRef,
  ViewChild,
  ViewContainerRef,
  ViewEncapsulation,
  effect,
} from '@angular/core';
import {WidgetWizardService} from '../../../../../services/widget-wizard.service';
import {WidgetManagementProcessSelectorComponent} from '../../../management-process-selector/widget-management-process-selector.component';

@Component({
  templateUrl: './widget-wizard-content-step.component.html',
  encapsulation: ViewEncapsulation.None,
  standalone: true,
  imports: [CommonModule, WidgetManagementProcessSelectorComponent],
})
export class WidgetWizardContentStepComponent implements AfterViewInit {
  @ViewChild('processSelector', {read: TemplateRef}) processSelector!: TemplateRef<any>;
  @ViewChild('contentRenderer', {read: ViewContainerRef})
  public projectedNodes: Node[][];

  public readonly $selectedWidget = this.widgetWizardService.$selectedWidget;
  public readonly $disableProcessSelector = this.widgetWizardService.$disableProcessSelector;
  public readonly $widgetContext = this.widgetWizardService.$widgetContext;

  constructor(
    private vcr: ViewContainerRef,
    private readonly widgetWizardService: WidgetWizardService
  ) {}

  public ngAfterViewInit(): void {
    if (!this.processSelector) return;
    const processSelectorNodes = this.vcr.createEmbeddedView(this.processSelector).rootNodes;

    this.projectedNodes = [processSelectorNodes];
  }
}
