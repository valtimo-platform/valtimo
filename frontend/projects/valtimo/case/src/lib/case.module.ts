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
import {HttpClient} from '@angular/common/http';
import {ModuleWithProviders, NgModule} from '@angular/core';
import {FormsModule, ReactiveFormsModule} from '@angular/forms';
import {
  NgbButtonsModule,
  NgbModule,
  NgbPaginationModule,
  NgbTooltipModule,
} from '@ng-bootstrap/ng-bootstrap';
import {TranslateLoader, TranslateModule} from '@ngx-translate/core';
import {
  BpmnJsDiagramModule,
  CamundaFormModule,
  CarbonListModule,
  CaseTagsSelectorComponent,
  ConfirmationModalModule,
  DataListModule,
  DropzoneModule,
  FilterSidebarModule,
  FormIoModule,
  FormModule as VFormModule,
  InputLabelModule,
  InputModule,
  IsArrayPipe,
  ModalModule,
  ParagraphModule,
  RenderInPageHeaderDirective,
  SearchableDropdownSelectModule,
  SearchFieldsModule,
  SelectModule,
  SpinnerModule,
  StatusSelectorComponent,
  TableModule,
  TimelineModule,
  UploaderModule,
  ValtimoCdsModalDirective,
  ValtimoCdsOverflowButtonDirective,
  VModalModule,
  WidgetModule,
} from '@valtimo/components';
import {ConfigModule, HttpLoaderFactory} from '@valtimo/shared';
import {FormModule} from '@valtimo/form';
import {ProcessLinkModule} from '@valtimo/process-link';
import {ProcessModule} from '@valtimo/process';
import {TaskModule} from '@valtimo/task';
import {
  ButtonModule as CarbonButtonModule,
  ComboBoxModule,
  DialogModule,
  DropdownModule,
  IconModule,
  LayerModule,
  LoadingModule,
  ModalModule as CarbonModalModule,
  SelectModule as CarbonSelectModule,
  SkeletonModule,
  TabsModule,
  TagModule,
  TilesModule,
} from 'carbon-components-angular';
import {NoteModalComponent} from './components/note-modal/note-modal.component';
import {CaseAssignUserComponent} from './components/case-assign-user/case-assign-user.component';
import {CaseBulkAssignModalComponent} from './components/case-bulk-assign-modal/case-bulk-assign-modal.component';
import {CaseDetailComponent} from './components/case-detail/case-detail.component';
import {CaseDetailTabAuditComponent} from './components/case-detail/tab/audit/audit.component';
import {CaseDetailTabDocumentsComponent} from './components/case-detail/tab/documents/documents.component';
import {CaseDetailTabNotesComponent} from './components/case-detail/tab/notes/notes.component';
import {CaseDetailTabProgressComponent} from './components/case-detail/tab/progress/progress.component';
import {CaseDetailTabS3DocumentsComponent} from './components/case-detail/tab/s3-documents/s3-documents.component';
import {CaseDetailTabSummaryComponent} from './components/case-detail/tab/summary/summary.component';
import {CaseListActionsComponent} from './components/case-list-actions/case-list-actions.component';
import {CaseListComponent} from './components/case-list/case-list.component';
import {CaseProcessStartModalComponent} from './components/case-process-start-modal/case-process-start-modal.component';
import {CaseRoutingModule} from './case-routing.module';
import {CaseSupportingProcessStartModalComponent} from './components/case-supporting-process-start-modal/case-supporting-process-start-modal.component';
import {CaseUpdateComponent} from './components/case-update/case-update.component';
import {TAB_MAP} from './constants';
import {CaseBulkAssignService, CaseService} from './services';
import {CaseDetailTabFormioComponent} from './components/case-detail/tab/formio/formio.component';
import {TabTranslatePipeModule} from './pipes';
import {CaseDetailTabNotFoundComponent} from './components/case-detail/tab/not-found/not-found.component';
import {CaseDetailWidgetsComponent} from './components/case-detail/tab/widgets/widgets.component';
import {CaseDetailTaskListComponent} from './components/case-detail-task-list/case-detail-task-list.component';
import {CaseDetailsTaskDetailComponent} from './components/case-detail-task-detail/case-detail-task-detail.component';
import {AngularSplitModule} from 'angular-split';

export type TabsFactory = () => Map<string, object>;

@NgModule({
  declarations: [
    CaseBulkAssignModalComponent,
    CaseListComponent,
    CaseListActionsComponent,
    CaseDetailComponent,
    CaseDetailTabSummaryComponent,
    CaseDetailTabProgressComponent,
    CaseDetailTabAuditComponent,
    CaseDetailTabDocumentsComponent,
    CaseDetailTabNotesComponent,
    CaseUpdateComponent,
    CaseProcessStartModalComponent,
    CaseSupportingProcessStartModalComponent,
    CaseDetailTabS3DocumentsComponent,
    CaseDetailTabNotFoundComponent,
    CaseAssignUserComponent,
    NoteModalComponent,
    CaseDetailTabFormioComponent,
  ],
  imports: [
    CommonModule,
    CaseRoutingModule,
    WidgetModule,
    BpmnJsDiagramModule,
    TimelineModule,
    CamundaFormModule,
    ProcessModule,
    FilterSidebarModule,
    NgbButtonsModule,
    DataListModule,
    FormsModule,
    ReactiveFormsModule,
    FormModule,
    FormIoModule,
    ModalModule,
    SpinnerModule,
    TranslateModule.forRoot({
      loader: {
        provide: TranslateLoader,
        useFactory: HttpLoaderFactory,
        deps: [HttpClient],
      },
    }),
    TaskModule,
    ModalModule,
    NgbTooltipModule,
    UploaderModule,
    DropzoneModule,
    NgbPaginationModule,
    ConfigModule,
    SelectModule,
    InputLabelModule,
    ParagraphModule,
    TableModule,
    VModalModule,
    SearchableDropdownSelectModule,
    SearchFieldsModule,
    FormModule,
    InputModule,
    VFormModule,
    NgbModule,
    LoadingModule,
    CarbonButtonModule,
    IconModule,
    ProcessLinkModule,
    CarbonModalModule,
    CarbonSelectModule,
    ConfirmationModalModule,
    DropdownModule,
    TabsModule,
    ComboBoxModule,
    TabTranslatePipeModule,
    CarbonListModule,
    IsArrayPipe,
    SkeletonModule,
    StatusSelectorComponent,
    RenderInPageHeaderDirective,
    TagModule,
    DialogModule,
    ValtimoCdsOverflowButtonDirective,
    CaseDetailWidgetsComponent,
    CaseDetailTaskListComponent,
    CaseDetailsTaskDetailComponent,
    AngularSplitModule,
    CaseTagsSelectorComponent,
    ValtimoCdsModalDirective,
    TilesModule,
    LayerModule,
  ],
  exports: [CaseListComponent, CaseDetailComponent, CaseProcessStartModalComponent],
})
export class CaseModule {
  static forRoot(tabsFactory: TabsFactory): ModuleWithProviders<CaseModule> {
    return {
      ngModule: CaseModule,
      providers: [
        CaseService,
        CaseBulkAssignService,
        {
          provide: TAB_MAP,
          useFactory: tabsFactory,
        },
      ],
    };
  }
}
