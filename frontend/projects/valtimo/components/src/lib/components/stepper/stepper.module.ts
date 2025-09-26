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

import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';
import {StepperContainerComponent} from './stepper-container/stepper-container.component';
import {StepperContentComponent} from './stepper-content/stepper-content.component';
import {StepperFooterComponent} from './stepper-footer/stepper-footer.component';
import {StepperHeaderComponent} from './stepper-header/stepper-header.component';
import {StepperStepComponent} from './stepper-step/stepper-step.component';
import {TranslateModule} from '@ngx-translate/core';
import {StepperFooterStepComponent} from './stepper-footer-step/stepper-footer-step.component';
import {ButtonModule} from '../button/button.module';
import {ButtonModule as CarbonButtonModule} from 'carbon-components-angular';

/**
 * @deprecated Migrate old design to Carbon
 */
@NgModule({
  declarations: [
    StepperContainerComponent,
    StepperContentComponent,
    StepperFooterComponent,
    StepperHeaderComponent,
    StepperStepComponent,
    StepperFooterStepComponent,
  ],
  imports: [CommonModule, TranslateModule, ButtonModule, CarbonButtonModule],
  exports: [
    StepperContainerComponent,
    StepperContentComponent,
    StepperFooterComponent,
    StepperHeaderComponent,
    StepperStepComponent,
    StepperFooterStepComponent,
  ],
})
export class StepperModule {}
