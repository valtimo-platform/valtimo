/*
 * Copyright 2015-2023 Ritense BV, the Netherlands.
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
  ButtonModule,
  CamundaFormModule,
  ConfirmationModalModule,
  DataListModule,
  DocumentenApiMetadataModalModule,
  DropzoneModule,
  FilterSidebarModule,
  FormIoModule,
  FormModule as VFormModule,
  InputLabelModule,
  InputModule,
  ListModule,
  ModalModule,
  PageModule,
  ParagraphModule,
  SearchableDropdownSelectModule,
  SearchFieldsModule,
  SelectModule,
  SpinnerModule,
  TableModule,
  TimelineModule,
  TitleModule,
  UploaderModule,
  VModalModule,
  WidgetModule,
  CarbonListModule,
} from '@valtimo/components';
import {ConfigModule, HttpLoaderFactory} from '@valtimo/config';
import {FormModule} from '@valtimo/form';
import {FormLinkModule} from '@valtimo/form-link';
import {ProcessModule} from '@valtimo/process';
import {TaskModule} from '@valtimo/task';
import {
  ButtonModule as CarbonButtonModule,
  ComboBoxModule,
  DropdownModule,
  IconModule,
  LoadingModule,
  ModalModule as CarbonModalModule,
  SelectModule as CarbonSelectModule,
  TabsModule,
} from 'carbon-components-angular';
import {NoteModalComponent} from './components/note-modal/note-modal.component';
import {DossierAssignUserComponent} from './components/dossier-assign-user/dossier-assign-user.component';
import {DossierBulkAssignModalComponent} from './components/dossier-bulk-assign-modal/dossier-bulk-assign-modal.component';
import {DossierDetailComponent} from './components/dossier-detail/dossier-detail.component';
import {DossierDetailTabAuditComponent} from './components/dossier-detail/tab/audit/audit.component';
import {DossierDetailTabContactMomentsComponent} from './components/dossier-detail/tab/contact-moments/contact-moments.component';
import {DossierDetailTabDocumentenApiDocumentsComponent} from './components/dossier-detail/tab/documenten-api-documents/documenten-api-documents.component';
import {DossierDetailTabDocumentsComponent} from './components/dossier-detail/tab/documents/documents.component';
import {DossierDetailTabNotesComponent} from './components/dossier-detail/tab/notes/notes.component';
import {DossierDetailTabObjectTypeComponent} from './components/dossier-detail/tab/object-type/object-type.component';
import {DossierDetailTabProgressComponent} from './components/dossier-detail/tab/progress/progress.component';
import {DossierDetailTabS3DocumentsComponent} from './components/dossier-detail/tab/s3-documents/s3-documents.component';
import {DossierDetailTabSummaryComponent} from './components/dossier-detail/tab/summary/summary.component';
import {DossierDetailTabZaakobjectenComponent} from './components/dossier-detail/tab/zaakobjecten/zaakobjecten.component';
import {DossierListActionsComponent} from './components/dossier-list-actions/dossier-list-actions.component';
import {DossierListComponent} from './components/dossier-list/dossier-list.component';
import {DossierProcessStartModalComponent} from './components/dossier-process-start-modal/dossier-process-start-modal.component';
import {DossierRoutingModule} from './dossier-routing.module';
import {DossierSupportingProcessStartModalComponent} from './components/dossier-supporting-process-start-modal/dossier-supporting-process-start-modal.component';
import {DossierUpdateComponent} from './components/dossier-update/dossier-update.component';
import {TAB_MAP} from './constants';
import {DossierBulkAssignService, DossierService} from './services';
import {DossierDetailTabFormioComponent} from './components/dossier-detail/tab/formio/formio.component';
import {TabTranslatePipeModule} from './pipes';

export type TabsFactory = () => Map<string, object>;

@NgModule({
  declarations: [
    DossierBulkAssignModalComponent,
    DossierListComponent,
    DossierListActionsComponent,
    DossierDetailComponent,
    DossierDetailTabSummaryComponent,
    DossierDetailTabProgressComponent,
    DossierDetailTabAuditComponent,
    DossierDetailTabDocumentsComponent,
    DossierDetailTabContactMomentsComponent,
    DossierDetailTabZaakobjectenComponent,
    DossierDetailTabNotesComponent,
    DossierUpdateComponent,
    DossierProcessStartModalComponent,
    DossierSupportingProcessStartModalComponent,
    DossierDetailTabObjectTypeComponent,
    DossierDetailTabDocumentenApiDocumentsComponent,
    DossierDetailTabS3DocumentsComponent,
    DossierAssignUserComponent,
    NoteModalComponent,
    DossierDetailTabFormioComponent,
  ],
  imports: [
    CommonModule,
    DossierRoutingModule,
    ListModule,
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
    TitleModule,
    ButtonModule,
    DocumentenApiMetadataModalModule,
    SearchableDropdownSelectModule,
    SearchFieldsModule,
    PageModule,
    FormModule,
    InputModule,
    VFormModule,
    NgbModule,
    LoadingModule,
    CarbonButtonModule,
    IconModule,
    FormLinkModule,
    CarbonModalModule,
    CarbonSelectModule,
    ConfirmationModalModule,
    DropdownModule,
    TabsModule,
    ComboBoxModule,
    TabTranslatePipeModule,
    CarbonListModule,
  ],
  exports: [DossierListComponent, DossierDetailComponent],
})
export class DossierModule {
  static forRoot(tabsFactory: TabsFactory): ModuleWithProviders<DossierModule> {
    return {
      ngModule: DossierModule,
      providers: [
        DossierService,
        DossierBulkAssignService,
        {
          provide: TAB_MAP,
          useFactory: tabsFactory,
        },
      ],
    };
  }
}
