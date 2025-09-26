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
import {VModalComponent} from './modal.component';
import {ButtonModule} from '../button/button.module';
import {ButtonModule as CarbonButtonModule, IconModule} from 'carbon-components-angular';

/**
 * @deprecated Migrate old design to Carbon
 */
@NgModule({
  declarations: [VModalComponent],
  imports: [CommonModule, ButtonModule, CarbonButtonModule, IconModule],
  exports: [VModalComponent],
})
export class VModalModule {}
