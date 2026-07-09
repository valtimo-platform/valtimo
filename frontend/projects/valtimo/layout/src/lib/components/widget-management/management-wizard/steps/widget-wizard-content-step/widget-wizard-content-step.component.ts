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
  ChangeDetectorRef,
  Component,
  effect,
  TemplateRef,
  ViewChild,
  ViewContainerRef,
  ViewEncapsulation,
} from '@angular/core';
import {WidgetWizardService} from '../../../../../services/widget-wizard.service';
import {WidgetManagementActionButtonComponent} from '../../../management-action-button/widget-management-action-button.component';

@Component({
  templateUrl: './widget-wizard-content-step.component.html',
  encapsulation: ViewEncapsulation.None,
  standalone: true,
  imports: [CommonModule, WidgetManagementActionButtonComponent],
})
export class WidgetWizardContentStepComponent implements AfterViewInit {
  @ViewChild('actionButton', {read: TemplateRef}) actionButton!: TemplateRef<any>;

  public projectedNodes: Node[][] = [];
  public contentReady = false;

  public readonly $selectedWidget = this.widgetWizardService.$selectedWidget;
  public readonly $disableActionButton = this.widgetWizardService.$disableActionButton;

  constructor(
    private readonly vcr: ViewContainerRef,
    private readonly cdr: ChangeDetectorRef,
    private readonly widgetWizardService: WidgetWizardService
  ) {
    effect(() => {
      if (this.widgetWizardService.$editMode())
        this.widgetWizardService.$widgetContentValid.set(true);
    });
  }

  public ngAfterViewInit(): void {
    if (this.actionButton) {
      this.projectedNodes = [this.vcr.createEmbeddedView(this.actionButton).rootNodes];
    }

    this.contentReady = true;
    this.cdr.detectChanges();
  }
}
