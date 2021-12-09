/*
 * Copyright 2015-2020 Ritense BV, the Netherlands.
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
import {BpmnJsDiagramModule, CamundaFormModule, ListModule, TimelineModule, WidgetModule} from '@valtimo/components';
import {ToastrModule} from 'ngx-toastr';
import {BrowserAnimationsModule} from '@angular/platform-browser/animations';
import {ProcessDiagramComponent} from './process-diagram/process-diagram.component';

@NgModule({
  declarations: [
    ProcessDiagramComponent
  ],
  imports: [
    CommonModule,
    ListModule,
    WidgetModule,
    TimelineModule,
    BpmnJsDiagramModule,
    CamundaFormModule,
    BrowserAnimationsModule,
    ToastrModule.forRoot({
      positionClass: 'toast-bottom-full-width',
      preventDuplicates: true
    })
  ],
  exports: [
    ProcessDiagramComponent
  ],
})

export class ProcessModule {

}
