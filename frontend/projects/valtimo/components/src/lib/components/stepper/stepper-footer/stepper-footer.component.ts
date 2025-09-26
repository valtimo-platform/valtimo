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

import {AfterContentInit, Component, ContentChildren, QueryList} from '@angular/core';
import {StepperFooterStepComponent} from '../stepper-footer-step/stepper-footer-step.component';

/**
 * @deprecated Migrate old design to Carbon
 */
@Component({
  selector: 'v-stepper-footer',
  templateUrl: './stepper-footer.component.html',
  styleUrls: ['./stepper-footer.component.scss'],
})
export class StepperFooterComponent implements AfterContentInit {
  @ContentChildren(StepperFooterStepComponent)
  footerStepComponents!: QueryList<StepperFooterStepComponent>;

  ngAfterContentInit(): void {
    this.setStepNumbers();
  }

  private setStepNumbers(): void {
    const footerStepComponents = this.footerStepComponents;

    footerStepComponents.forEach((footerStepComponent, index) => {
      footerStepComponent.stepIndex$.next(index);
      footerStepComponent.isLastStep$.next(index === footerStepComponents.length - 1);
    });
  }
}
