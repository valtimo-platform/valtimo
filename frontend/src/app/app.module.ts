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

import {BrowserModule} from '@angular/platform-browser';
import {Injector, NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';
import {HttpClient, HttpClientModule} from '@angular/common/http';
import {AppRoutingModule} from './app-routing.module';
import {AppComponent} from './app.component';
import {LayoutModule} from '@valtimo/layout';
import {TaskModule} from '@valtimo/task';
import {environment} from '../environments/environment';
import {SecurityModule} from '@valtimo/security';
import {
  BpmnJsDiagramModule,
  CardModule,
  FormIoModule,
  FormIoUploaderComponent,
  MenuModule,
  registerFormioUploadComponent,
  UploaderModule,
  WidgetModule,
  FormIoStateService,
  registerFormioFileSelectorComponent,
} from '@valtimo/components';
import {ChoicefieldModule} from '@valtimo/choicefield';
import {
  DefaultTabs,
  DossierDetailTabAuditComponent,
  DossierDetailTabContactMomentsComponent,
  DossierDetailTabDocumentsComponent,
  DossierDetailTabProgressComponent,
  DossierDetailTabSummaryComponent,
  DossierModule,
} from '@valtimo/dossier';
import {ProcessModule} from '@valtimo/process';
import {ViewConfiguratorModule} from '@valtimo/view-configurator';
import {FormsModule, ReactiveFormsModule} from '@angular/forms';
import {CustomFormExampleComponent} from './custom-form-example/custom-form-example.component';
import {StartProcessCustomFormComponent} from './start-process-custom-form/start-process-custom-form.component';
import {ContextModule} from '@valtimo/context';
import {DashboardModule} from '@valtimo/dashboard';
import {DocumentModule} from '@valtimo/document';
import {ContactMomentModule} from '@valtimo/contact-moment';
import {AccountModule} from '@valtimo/account';
import {UserManagementModule} from '@valtimo/user-management';
import {AuthorityModule} from '@valtimo/authority';
import {ChoiceFieldModule} from '@valtimo/choice-field';
import {ResourceModule} from '@valtimo/resource';
import {FormioComponent} from './form-io/form-io.component';
import {FormModule} from '@valtimo/form';
import {UploadShowcaseComponent} from './upload-showcase/upload-showcase.component';
import {ManagementContextModule} from '@valtimo/management';
import {CustomDossierTabComponent} from './custom-dossier-tab/custom-dossier-tab.component';
import {CustomMapsTabComponent} from './custom-maps-tab/custom-maps-tab.component';
import {SwaggerModule} from '@valtimo/swagger';
import {AnalyseModule} from '@valtimo/analyse';
import {ProcessManagementModule} from '@valtimo/process-management';
import {DecisionModule} from '@valtimo/decision';
import {MilestoneModule} from '@valtimo/milestone';
import {LoggerModule} from 'ngx-logger';
import {FormLinkModule} from '@valtimo/form-link';
import {MigrationModule} from '@valtimo/migration';
import {BootstrapModule} from '@valtimo/bootstrap';
import {ConfigModule, ConfigService, MultiTranslateHttpLoaderFactory} from '@valtimo/config';
import {FormManagementModule} from '@valtimo/form-management';
import {DossierManagementModule} from '@valtimo/dossier-management';
import {OpenZaakModule} from '@valtimo/open-zaak';
import {TranslateLoader, TranslateModule} from '@ngx-translate/core';
import {ConnectorManagementModule} from '@valtimo/connector-management';

export function tabsFactory() {
  return new Map<string, object>([
    [DefaultTabs.summary, DossierDetailTabSummaryComponent],
    [DefaultTabs.progress, DossierDetailTabProgressComponent],
    [DefaultTabs.audit, DossierDetailTabAuditComponent],
    [DefaultTabs.documents, DossierDetailTabDocumentsComponent],
    [DefaultTabs.contactMoments, DossierDetailTabContactMomentsComponent],
    ['custom-maps', CustomMapsTabComponent],
    ['custom-dossier', CustomDossierTabComponent],
  ]);
}

@NgModule({
  declarations: [
    AppComponent,
    CustomFormExampleComponent,
    StartProcessCustomFormComponent,
    FormioComponent,
    UploadShowcaseComponent,
    CustomDossierTabComponent,
    CustomMapsTabComponent,
  ],
  imports: [
    HttpClientModule,
    CommonModule,
    BrowserModule,
    AppRoutingModule,
    LayoutModule,
    CardModule,
    WidgetModule,
    BootstrapModule,
    ConfigModule.forRoot(environment),
    LoggerModule.forRoot(environment.logger),
    environment.authentication.module,
    SecurityModule,
    MenuModule,
    TaskModule,
    ChoicefieldModule,
    DossierModule.forRoot(tabsFactory),
    ProcessModule,
    ViewConfiguratorModule,
    BpmnJsDiagramModule,
    FormsModule,
    ReactiveFormsModule,
    ContactMomentModule,
    ContextModule,
    DashboardModule,
    DocumentModule,
    AccountModule,
    UserManagementModule,
    AuthorityModule,
    ChoiceFieldModule,
    ResourceModule,
    FormModule,
    FormIoModule,
    UploaderModule,
    ManagementContextModule,
    AnalyseModule,
    SwaggerModule,
    ConnectorManagementModule,
    ProcessManagementModule,
    DecisionModule,
    MilestoneModule,
    FormLinkModule,
    MigrationModule,
    FormManagementModule,
    DossierManagementModule,
    OpenZaakModule,
    HttpClientModule,
    TranslateModule.forRoot({
      loader: {
        provide: TranslateLoader,
        useFactory: MultiTranslateHttpLoaderFactory,
        deps: [HttpClient, ConfigService],
      },
    }),
  ],
  providers: [FormioComponent, FormIoStateService],
  entryComponents: [
    CustomFormExampleComponent,
    StartProcessCustomFormComponent,
    FormIoUploaderComponent,
  ],
  bootstrap: [AppComponent],
})
export class AppModule {
  constructor(injector: Injector) {
    registerFormioUploadComponent(injector);
    registerFormioFileSelectorComponent(injector);
  }
}
