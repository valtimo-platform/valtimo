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

import {BrowserModule} from '@angular/platform-browser';
import {Injector, NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';
import {
  HttpBackend,
  HttpClient,
  provideHttpClient,
  withInterceptorsFromDi,
} from '@angular/common/http';
import {AppRoutingModule} from './app-routing.module';
import {AppComponent} from './app.component';
import {LayoutModule, TranslationManagementModule} from '@valtimo/layout';
import {TaskModule} from '@valtimo/task';
import {environment} from '../environments/environment';
import {SecurityModule} from '@valtimo/security';
import {
  BpmnJsDiagramModule,
  enableCustomFormioComponents,
  FormIoModule,
  MenuModule,
  registerFormioCurrencyComponent,
  registerFormioCurrentUserComponent,
  registerFormioFileSelectorComponent,
  registerFormioIbanComponent,
  registerFormioUploadComponent,
  registerFormioValueResolverSelectorComponent,
  UploaderModule,
  WidgetModule,
} from '@valtimo/components';
import {
  CASE_TAB_TOKEN,
  CaseDetailTabAuditComponent,
  CaseDetailTabDocumentsComponent,
  CaseDetailTabNotesComponent,
  CaseDetailTabProgressComponent,
  CaseDetailTabSummaryComponent,
  CaseModule,
  CUSTOM_CASE_WIDGET_TOKEN,
  DefaultTabs,
} from '@valtimo/case';
import {ProcessModule} from '@valtimo/process';
import {FormsModule, ReactiveFormsModule} from '@angular/forms';
import {CustomFormExampleComponent} from './custom-form-example/custom-form-example.component';
import {StartProcessCustomFormComponent} from './start-process-custom-form/start-process-custom-form.component';
import {DashboardModule} from '@valtimo/dashboard';
import {DashboardManagementModule} from '@valtimo/dashboard-management';
import {DocumentModule} from '@valtimo/document';
import {AccountModule} from '@valtimo/account';
import {ChoiceFieldModule} from '@valtimo/choice-field';
import {ResourceModule} from '@valtimo/resource';
import {FormioComponent} from './form-io/form-io.component';
import {FormModule} from '@valtimo/form';
import {UploadShowcaseComponent} from './upload-showcase/upload-showcase.component';
import {CustomCaseTabComponent} from './custom-case-tab/custom-case-tab.component';
import {CustomMapsTabComponent} from './custom-maps-tab/custom-maps-tab.component';
import {SwaggerModule} from '@valtimo/swagger';
import {AnalyseModule} from '@valtimo/analyse';
import {ProcessManagementModule} from '@valtimo/process-management';
import {DecisionModule} from '@valtimo/decision';
import {MilestoneModule} from '@valtimo/milestone';
import {LoggerModule} from 'ngx-logger';
import {
  FORM_CUSTOM_COMPONENT_TOKEN,
  FORM_FLOW_COMPONENT_TOKEN,
  ProcessLinkModule,
} from '@valtimo/process-link';
import {MigrationModule} from '@valtimo/migration';
import {BootstrapModule} from '@valtimo/bootstrap';
import {
  ConfigModule,
  ConfigService,
  CustomMultiTranslateHttpLoaderFactory,
  LocalizationService,
} from '@valtimo/shared';
import {FormManagementModule} from '@valtimo/form-management';
import {TranslateLoader, TranslateModule} from '@ngx-translate/core';
import {PluginManagementModule} from '@valtimo/plugin-management';
import {
  BesluitenApiPluginModule,
  besluitenApiPluginSpecification,
  CatalogiApiPluginModule,
  catalogiApiPluginSpecification,
  DocumentenApiPluginModule,
  documentenApiPluginSpecification,
  NotificatiesApiPluginModule,
  notificatiesApiPluginSpecification,
  ObjectenApiPluginModule,
  objectenApiPluginSpecification,
  ObjectTokenAuthenticationPluginModule,
  objectTokenAuthenticationPluginSpecification,
  ObjecttypenApiPluginModule,
  objecttypenApiPluginSpecification,
  OpenNotificatiesPluginModule,
  openNotificatiesPluginSpecification,
  OpenZaakPluginModule,
  openZaakPluginSpecification,
  PLUGINS_TOKEN,
  PortaaltaakPluginModule,
  portaaltaakPluginSpecification,
  SmartDocumentsPluginModule,
  smartDocumentsPluginSpecification,
  VerzoekPluginModule,
  verzoekPluginSpecification,
  ZakenApiPluginModule,
  zakenApiPluginSpecification,
} from '@valtimo/plugin';
import {ObjectManagementModule} from '@valtimo/object-management';
import {ObjectModule} from '@valtimo/object';
import {AccessControlManagementModule} from '@valtimo/access-control-management';
import {FormFlowManagementModule} from '@valtimo/form-flow-management';
import {CustomFormFlowComponent} from '@src/app/custom-form-flow-component/custom-form-flow.component';
import {TaskManagementModule} from '@valtimo/task-management';
import {CaseMigrationModule} from '@valtimo/case-migration';
import {
  CaseDetailTabZaakobjectenComponent,
  registerDocumentenApiFormioUploadComponent,
  ZgwModule,
} from '@valtimo/zgw';
import {LoggingModule} from '@valtimo/logging';
import {FormViewModelModule} from '@valtimo/form-view-model';
import {CaseManagementModule} from '@valtimo/case-management';
import {CustomFormComponent} from '@src/app/custom-form-component/custom-form.component';
import {IkoModule} from '@valtimo/iko';

export function tabsFactory() {
  return new Map<string, object>([
    [DefaultTabs.summary, CaseDetailTabSummaryComponent],
    [DefaultTabs.progress, CaseDetailTabProgressComponent],
    [DefaultTabs.audit, CaseDetailTabAuditComponent],
    [DefaultTabs.documents, CaseDetailTabDocumentsComponent],
    [DefaultTabs.notes, CaseDetailTabNotesComponent],
    ['custom-maps', CustomMapsTabComponent],
    ['custom-dossier', CustomCaseTabComponent],
  ]);
}

@NgModule({
  declarations: [
    AppComponent,
    CustomFormExampleComponent,
    StartProcessCustomFormComponent,
    FormioComponent,
    UploadShowcaseComponent,
    CustomCaseTabComponent,
    CustomMapsTabComponent,
  ],
  bootstrap: [AppComponent],
  imports: [
    CommonModule,
    BrowserModule,
    AppRoutingModule,
    LayoutModule,
    WidgetModule,
    BootstrapModule,
    ConfigModule.forRoot(environment),
    LoggerModule.forRoot(environment.logger),
    environment.authentication.module,
    SecurityModule,
    MenuModule,
    TaskModule,
    CaseMigrationModule,
    CaseModule.forRoot(tabsFactory),
    ProcessModule,
    BpmnJsDiagramModule,
    FormsModule,
    ReactiveFormsModule,
    DashboardModule,
    DashboardManagementModule,
    DocumentModule,
    AccountModule,
    ChoiceFieldModule,
    ResourceModule,
    FormModule,
    FormIoModule,
    UploaderModule,
    AnalyseModule,
    SwaggerModule,
    ProcessManagementModule,
    DecisionModule,
    MilestoneModule,
    ProcessLinkModule,
    MigrationModule,
    FormFlowManagementModule,
    CaseManagementModule,
    PluginManagementModule,
    NotificatiesApiPluginModule,
    ObjectTokenAuthenticationPluginModule,
    OpenNotificatiesPluginModule,
    PortaaltaakPluginModule,
    OpenZaakPluginModule,
    SmartDocumentsPluginModule,
    DocumentenApiPluginModule,
    ObjecttypenApiPluginModule,
    ZakenApiPluginModule,
    ObjectenApiPluginModule,
    BesluitenApiPluginModule,
    CatalogiApiPluginModule,
    VerzoekPluginModule,
    TranslateModule.forRoot({
      loader: {
        provide: TranslateLoader,
        useFactory: CustomMultiTranslateHttpLoaderFactory,
        deps: [HttpBackend, HttpClient, ConfigService, LocalizationService],
      },
    }),
    ObjectModule,
    ObjectManagementModule,
    AccessControlManagementModule,
    TranslationManagementModule,
    CustomFormFlowComponent,
    TaskManagementModule,
    ZgwModule,
    FormViewModelModule,
    LoggingModule,
    FormManagementModule,
    IkoModule,
  ],
  providers: [
    provideHttpClient(withInterceptorsFromDi()),
    FormioComponent,
    {
      provide: PLUGINS_TOKEN,
      useValue: [
        besluitenApiPluginSpecification,
        catalogiApiPluginSpecification,
        documentenApiPluginSpecification,
        notificatiesApiPluginSpecification,
        objectenApiPluginSpecification,
        objectTokenAuthenticationPluginSpecification,
        objecttypenApiPluginSpecification,
        openNotificatiesPluginSpecification,
        openZaakPluginSpecification,
        portaaltaakPluginSpecification,
        smartDocumentsPluginSpecification,
        zakenApiPluginSpecification,
        verzoekPluginSpecification,
      ],
    },
    {
      provide: CASE_TAB_TOKEN,
      useValue: {
        'custom-dossier-tab': CustomCaseTabComponent,
        zaakobjecten: CaseDetailTabZaakobjectenComponent,
      },
    },
    {
      provide: FORM_FLOW_COMPONENT_TOKEN,
      useValue: [
        {
          id: 'test-component',
          component: CustomFormFlowComponent,
        },
      ],
    },
    {
      provide: CUSTOM_CASE_WIDGET_TOKEN,
      useValue: {
        caseWidgetComponent: CustomCaseTabComponent,
      },
    },
    {
      provide: FORM_CUSTOM_COMPONENT_TOKEN,
      useValue: {
        dummy: CustomFormComponent,
      },
    },
  ],
})
export class AppModule {
  constructor(injector: Injector) {
    enableCustomFormioComponents(injector);
    registerFormioCurrentUserComponent(injector);
    registerFormioUploadComponent(injector);
    registerFormioFileSelectorComponent(injector);
    registerDocumentenApiFormioUploadComponent(injector);
    registerFormioIbanComponent(injector);
    registerFormioCurrencyComponent(injector);
    registerFormioValueResolverSelectorComponent(injector);
  }
}
