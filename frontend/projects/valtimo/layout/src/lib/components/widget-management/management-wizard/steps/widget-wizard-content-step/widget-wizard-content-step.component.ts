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
  Component,
  effect,
  TemplateRef,
  ViewChild,
  ViewContainerRef,
  ViewEncapsulation,
} from '@angular/core';
import {WidgetWizardService} from '../../../../../services/widget-wizard.service';
import {WidgetManagementActionButtonComponent} from '../../../management-action-button/widget-management-action-button.component';
import { TEST_IDS } from '@valtimo/shared';

@Component({
  templateUrl: './widget-wizard-content-step.component.html',
  encapsulation: ViewEncapsulation.None,
  standalone: true,
  imports: [CommonModule, WidgetManagementActionButtonComponent],
})
export class WidgetWizardContentStepComponent implements AfterViewInit {
  readonly TEST_IDS = TEST_IDS;

  @ViewChild('actionButton', {read: TemplateRef}) actionButton!: TemplateRef<any>;
  @ViewChild('contentRenderer', {read: ViewContainerRef})
  public projectedNodes: Node[][];

  public readonly $selectedWidget = this.widgetWizardService.$selectedWidget;
  public readonly $disableActionButton = this.widgetWizardService.$disableActionButton;

  constructor(
    private readonly vcr: ViewContainerRef,
    private readonly widgetWizardService: WidgetWizardService
  ) {
    effect(() => {
      if (this.widgetWizardService.$editMode())
        this.widgetWizardService.$widgetContentValid.set(true);
    });
  }

  public ngAfterViewInit(): void {
    if (!this.actionButton) return;
    const processSelectorNodes = this.vcr.createEmbeddedView(this.actionButton).rootNodes;

    this.projectedNodes = [processSelectorNodes];
  }
}
