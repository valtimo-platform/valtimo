/*
 * Copyright 2015-2026 Ritense BV, the Netherlands.
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

import {Injector, NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';
import {BrowserModule} from '@angular/platform-browser';
import {FormsModule, ReactiveFormsModule} from '@angular/forms';
import {
  HttpBackend,
  HttpClient,
  provideHttpClient,
  withInterceptorsFromDi,
} from '@angular/common/http';
import {TranslateLoader, TranslateModule} from '@ngx-translate/core';
import {LoggerModule} from 'ngx-logger';

import {AppComponent} from './app.component';
import {AppRoutingModule} from './app-routing.module';
import {environment} from '../environments/environment';

import {AccessControlManagementModule} from '@valtimo/access-control-management';
import {AccountModule} from '@valtimo/account';
import {AdminSettingsModule} from '@valtimo/admin-settings';
import {AnalyseModule} from '@valtimo/analyse';
import {BootstrapModule} from '@valtimo/bootstrap';
import {BuildingBlockManagementModule} from '@valtimo/building-block-management';
import {
  CaseDetailTabAuditComponent,
  CaseDetailTabDocumentsComponent,
  CaseDetailTabNotesComponent,
  CaseDetailTabProgressComponent,
  CaseDetailTabSummaryComponent,
  CaseModule,
  DefaultTabs,
} from '@valtimo/case';
import {CaseManagementModule} from '@valtimo/case-management';
import {CaseMigrationModule} from '@valtimo/case-migration';
import {ChoiceFieldModule} from '@valtimo/choice-field';
import {
  BpmnJsDiagramModule,
  enableCustomFormioComponents,
  MenuModule,
  registerFormioCurrencyComponent,
  registerFormioCurrentUserComponent,
  registerFormioFileSelectorComponent,
  registerFormioIbanComponent,
  registerFormioUploadComponent,
  registerFormioValueResolverSelectorComponent,
  WidgetModule,
} from '@valtimo/components';
import {DashboardModule} from '@valtimo/dashboard';
import {DashboardManagementModule} from '@valtimo/dashboard-management';
import {DecisionModule} from '@valtimo/decision';
import {DocumentModule} from '@valtimo/document';
import {FormModule} from '@valtimo/form';
import {FormFlowManagementModule} from '@valtimo/form-flow-management';
import {FormManagementModule} from '@valtimo/form-management';
import {IkoModule, registerIkoSearchFormioComponent} from '@valtimo/iko';
import {LayoutModule, TranslationManagementModule} from '@valtimo/layout';
import {LoggingModule} from '@valtimo/logging';
import {MigrationModule} from '@valtimo/migration';
import {MilestoneModule} from '@valtimo/milestone';
import {ObjectModule} from '@valtimo/object';
import {ObjectManagementModule} from '@valtimo/object-management';
import {
  BesluitenApiPluginModule,
  besluitenApiPluginSpecification,
  CatalogiApiPluginModule,
  catalogiApiPluginSpecification,
  DocumentenApiPluginModule,
  documentenApiPluginSpecification,
  DocumentenApiPreviewPluginModule,
  documentenApiPreviewPluginSpecification,
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
import {PluginManagementModule} from '@valtimo/plugin-management';
import {ProcessModule} from '@valtimo/process';
import {ProcessLinkModule} from '@valtimo/process-link';
import {ProcessManagementModule} from '@valtimo/process-management';
import {ResourceModule} from '@valtimo/resource';
import {SecurityModule} from '@valtimo/security';
import {
  ConfigModule,
  ConfigService,
  CustomMultiTranslateHttpLoaderFactory,
  LocalizationService,
} from '@valtimo/shared';
import {SseModule} from '@valtimo/sse';
import {SwaggerModule} from '@valtimo/swagger';
import {TaskModule} from '@valtimo/task';
import {TeamsModule} from '@valtimo/teams';
import {registerDocumentenApiFormioUploadComponent, ZgwModule} from '@valtimo/zgw';

import {pluginImports, pluginSpecifications} from './app-plugins';

export function tabsFactory() {
  return new Map<string, object>([
    [DefaultTabs.summary, CaseDetailTabSummaryComponent],
    [DefaultTabs.progress, CaseDetailTabProgressComponent],
    [DefaultTabs.audit, CaseDetailTabAuditComponent],
    [DefaultTabs.documents, CaseDetailTabDocumentsComponent],
    [DefaultTabs.notes, CaseDetailTabNotesComponent],
  ]);
}

@NgModule({
  declarations: [AppComponent],
  bootstrap: [AppComponent],
  imports: [
    BrowserModule,
    CommonModule,
    AppRoutingModule,
    FormsModule,
    ReactiveFormsModule,
    ConfigModule.forRoot(environment),
    LoggerModule.forRoot(environment.logger),
    environment.authentication.module,
    CaseModule.forRoot(tabsFactory),
    TranslateModule.forRoot({
      loader: {
        provide: TranslateLoader,
        useFactory: CustomMultiTranslateHttpLoaderFactory,
        deps: [HttpBackend, HttpClient, ConfigService, LocalizationService],
      },
    }),
    // layout / shell
    LayoutModule,
    BootstrapModule,
    SecurityModule,
    MenuModule,
    WidgetModule,
    BpmnJsDiagramModule,
    // task / case / process
    TaskModule,
    CaseMigrationModule,
    CaseManagementModule,
    ProcessModule,
    ProcessLinkModule,
    ProcessManagementModule,
    // form
    FormModule,
    FormManagementModule,
    FormFlowManagementModule,
    // dashboard / document / account
    DashboardModule,
    DashboardManagementModule,
    DocumentModule,
    AccountModule,
    ChoiceFieldModule,
    ResourceModule,
    // analysis / swagger / decision / milestone / migration
    AnalyseModule,
    SwaggerModule,
    DecisionModule,
    MilestoneModule,
    MigrationModule,
    // management
    PluginManagementModule,
    ObjectManagementModule,
    ObjectModule,
    AccessControlManagementModule,
    TranslationManagementModule,
    // zgw / iko / logging
    ZgwModule,
    IkoModule,
    LoggingModule,
    // admin / building blocks / teams
    AdminSettingsModule,
    BuildingBlockManagementModule,
    TeamsModule,
    // plugin modules used by every variant
    BesluitenApiPluginModule,
    CatalogiApiPluginModule,
    DocumentenApiPluginModule,
    DocumentenApiPreviewPluginModule,
    NotificatiesApiPluginModule,
    ObjectenApiPluginModule,
    ObjectTokenAuthenticationPluginModule,
    ObjecttypenApiPluginModule,
    OpenNotificatiesPluginModule,
    OpenZaakPluginModule,
    PortaaltaakPluginModule,
    SmartDocumentsPluginModule,
    ZakenApiPluginModule,
    VerzoekPluginModule,
    // gzac-only feature modules
    SseModule,
    ...pluginImports,
  ],
  providers: [
    provideHttpClient(withInterceptorsFromDi()),
    {
      provide: PLUGINS_TOKEN,
      useValue: [
        besluitenApiPluginSpecification,
        catalogiApiPluginSpecification,
        documentenApiPluginSpecification,
        documentenApiPreviewPluginSpecification,
        notificatiesApiPluginSpecification,
        objectTokenAuthenticationPluginSpecification,
        objectenApiPluginSpecification,
        objecttypenApiPluginSpecification,
        openNotificatiesPluginSpecification,
        openZaakPluginSpecification,
        portaaltaakPluginSpecification,
        smartDocumentsPluginSpecification,
        verzoekPluginSpecification,
        zakenApiPluginSpecification,
        ...pluginSpecifications,
      ],
    },
  ],
})
export class AppModule {
  constructor(injector: Injector) {
    enableCustomFormioComponents(injector);
    registerFormioCurrencyComponent(injector);
    registerFormioCurrentUserComponent(injector);
    registerFormioFileSelectorComponent(injector);
    registerFormioUploadComponent(injector);
    registerFormioValueResolverSelectorComponent(injector);
    registerFormioIbanComponent(injector);
    registerDocumentenApiFormioUploadComponent(injector);
    registerIkoSearchFormioComponent(injector);
  }
}
