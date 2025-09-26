/*
 * Copyright 2015-2024 Ritense BV, the Netherlands.
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
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  OnInit,
  Output,
  ViewChild,
  ViewContainerRef,
  ViewEncapsulation,
} from '@angular/core';
import {WidgetWizardService} from '../../../../services';

@Component({
  selector: 'valtimo-widget-wizard-content-step',
  templateUrl: './widget-wizard-content-step.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  standalone: true,
  imports: [CommonModule],
})
export class WidgetWizardContentStepComponent implements OnInit {
  @ViewChild('contentRenderer', {static: true, read: ViewContainerRef})
  private readonly _vcr: ViewContainerRef;

  @Output() public contentValidEvent = new EventEmitter<boolean>();

  constructor(
    private readonly cdr: ChangeDetectorRef,
    private readonly widgetWizardService: WidgetWizardService
  ) {}

  public ngOnInit(): void {
    this.renderComponent();
  }

  private renderComponent(): void {
    this._vcr.clear();
    const widget = this.widgetWizardService.selectedWidget();
    if (!widget) return;

    const componentInstance = this._vcr.createComponent(widget.component).instance;
    if (!componentInstance) return;

    componentInstance.changeValidEvent.subscribe((valid: boolean) =>
      this.contentValidEvent.emit(valid)
    );

    this.cdr.detectChanges();
  }
}
