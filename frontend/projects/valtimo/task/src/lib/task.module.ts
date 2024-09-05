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
import {HttpClient} from '@angular/common/http';
import {NgModule} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {BrowserAnimationsModule} from '@angular/platform-browser/animations';
import {NgbModule} from '@ng-bootstrap/ng-bootstrap';
import {TranslateLoader, TranslateModule} from '@ngx-translate/core';
import {
  CamundaFormModule,
  CarbonListModule,
  ConfirmationModalModule,
  FormIoModule,
  PageHeaderModule,
  RenderInPageHeaderDirectiveModule,
  SearchableDropdownSelectModule,
  SearchFieldsModule,
  SpinnerModule,
  WidgetModule,
} from '@valtimo/components';
import {HttpLoaderFactory} from '@valtimo/config';
import {ProcessLinkModule} from '@valtimo/process-link';
import {
  ButtonModule,
  ContentSwitcherModule,
  DropdownModule,
  IconModule,
  LinkModule,
  ModalModule,
  TabsModule,
  TooltipModule,
} from 'carbon-components-angular';
import {ToastrModule} from 'ngx-toastr';
import {AssignUserToTaskComponent} from './components/assign-user-to-task/assign-user-to-task.component';
import {TaskDetailModalComponent} from './components/task-detail-modal/task-detail-modal.component';
import {TaskListComponent} from './components/task-list/task-list.component';
import {TaskRoutingModule} from './task-routing.module';
import {TaskDetailContentComponent} from './components/task-detail-content/task-detail-content.component';
import {TaskDetailIntermediateSaveComponent} from './components/task-detail-intermediate-save/task-detail-intermediate-save.component';

@NgModule({
  declarations: [TaskListComponent, TaskDetailModalComponent],
  imports: [
    CommonModule,
    TaskRoutingModule,
    CarbonListModule,
    PageHeaderModule,
    WidgetModule,
    SpinnerModule,
    SearchableDropdownSelectModule,
    CamundaFormModule,
    BrowserAnimationsModule,
    FormsModule,
    ToastrModule.forRoot({
      positionClass: 'toast-bottom-full-width',
      preventDuplicates: true,
    }),
    TranslateModule.forRoot({
      loader: {
        provide: TranslateLoader,
        useFactory: HttpLoaderFactory,
        deps: [HttpClient],
      },
    }),
    NgbModule,
    FormIoModule,
    ModalModule,
    LinkModule,
    ProcessLinkModule,
    TabsModule,
    ContentSwitcherModule,
    RenderInPageHeaderDirectiveModule,
    DropdownModule,
    ButtonModule,
    IconModule,
    TooltipModule,
    ConfirmationModalModule,
    SearchFieldsModule,
    AssignUserToTaskComponent,
    TaskDetailContentComponent,
    TaskDetailIntermediateSaveComponent,
  ],
  exports: [TaskListComponent, TaskDetailModalComponent],
})
export class TaskModule {}
