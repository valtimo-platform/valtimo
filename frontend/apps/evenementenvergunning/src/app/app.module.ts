import {BrowserModule} from '@angular/platform-browser';
import {Injector, NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';
import {HttpBackend, HttpClient, HttpClientModule} from '@angular/common/http';
import {AppRoutingModule} from './app-routing.module';
import {AppComponent} from './app.component';
import {LayoutModule, TranslationManagementModule} from '@valtimo/layout';
import {TaskModule} from '@valtimo/task';
import {environment} from '../environments/environment';
import {SecurityModule} from '@valtimo/security';
import {
  BpmnJsDiagramModule,
  CardModule,
  enableCustomFormioComponents,
  MenuModule,
  registerFormioCurrencyComponent,
  registerFormioFileSelectorComponent,
  registerFormioUploadComponent,
  registerFormioValueResolverSelectorComponent,
  WidgetModule
} from '@valtimo/components';
import {
  DefaultTabs,
  DossierDetailTabAuditComponent,
  DossierDetailTabDocumentsComponent,
  DossierDetailTabNotesComponent,
  DossierDetailTabProgressComponent,
  DossierDetailTabSummaryComponent,
  DossierModule
} from '@valtimo/dossier';
import {ProcessModule} from '@valtimo/process';
import {FormsModule, ReactiveFormsModule} from '@angular/forms';
import {
  CaseCountDataSourceModule,
  CaseCountsDataSourceModule,
  CaseGroupByDataSourceModule,
  DashboardModule,
  DisplayWidgetTypesModule,
} from '@valtimo/dashboard';
import {DocumentModule} from '@valtimo/document';
import {AccountModule} from '@valtimo/account';
import {ChoiceFieldModule} from '@valtimo/choice-field';
import {ResourceModule} from '@valtimo/resource';
import {FormModule} from '@valtimo/form';
import {SwaggerModule} from '@valtimo/swagger';
import {AnalyseModule} from '@valtimo/analyse';
import {ProcessManagementModule} from '@valtimo/process-management';
import {DecisionModule} from '@valtimo/decision';
import {MilestoneModule} from '@valtimo/milestone';
import {LoggerModule} from 'ngx-logger';
import {FormManagementModule} from '@valtimo/form-management';
import {ProcessLinkModule} from '@valtimo/process-link';
import {MigrationModule} from '@valtimo/migration';
import {DossierManagementModule} from '@valtimo/dossier-management';
import {BootstrapModule} from '@valtimo/bootstrap';
import {
  ConfigModule,
  ConfigService,
  CustomMultiTranslateHttpLoaderFactory,
  LocalizationService,
} from '@valtimo/config';
import {TranslateLoader, TranslateModule} from '@ngx-translate/core';
import {FormFlowManagementModule} from '@valtimo/form-flow-management';
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
  zakenApiPluginSpecification
} from '@valtimo/plugin';
import {ObjectManagementModule} from '@valtimo/object-management';
import {ObjectModule} from '@valtimo/object';
import {AccessControlManagementModule} from '@valtimo/access-control-management';
import {DashboardManagementModule} from '@valtimo/dashboard-management';
import {TaskManagementModule} from '@valtimo/task-management';
import {CaseMigrationModule} from '@valtimo/case-migration';
import {
  registerDocumentenApiFormioUploadComponent,
  ZgwModule
} from '@valtimo/zgw';
import {LoggingModule} from '@valtimo/logging';

export function tabsFactory() {
  return new Map<string, object>([
    [DefaultTabs.summary, DossierDetailTabSummaryComponent],
    [DefaultTabs.progress, DossierDetailTabProgressComponent],
    [DefaultTabs.audit, DossierDetailTabAuditComponent],
    [DefaultTabs.documents, DossierDetailTabDocumentsComponent],
    [DefaultTabs.notes, DossierDetailTabNotesComponent],
  ]);
}

@NgModule({
  declarations: [
    AppComponent
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
    CaseMigrationModule,
    DossierModule.forRoot(tabsFactory),
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
    AnalyseModule,
    SwaggerModule,
    FormFlowManagementModule,
    ProcessManagementModule,
    DecisionModule,
    MilestoneModule,
    FormManagementModule,
    ProcessLinkModule,
    MigrationModule,
    DossierManagementModule,
    PluginManagementModule,
    OpenZaakPluginModule,
    SmartDocumentsPluginModule,
    BesluitenApiPluginModule,
    DocumentenApiPluginModule,
    ZakenApiPluginModule,
    ObjectenApiPluginModule,
    ObjecttypenApiPluginModule,
    ObjectTokenAuthenticationPluginModule,
    ObjectModule,
    ObjectManagementModule,
    CatalogiApiPluginModule,
    NotificatiesApiPluginModule,
    OpenNotificatiesPluginModule,
    PortaaltaakPluginModule,
    VerzoekPluginModule,
    DisplayWidgetTypesModule,
    CaseCountDataSourceModule,
    CaseCountsDataSourceModule,
    CaseGroupByDataSourceModule,
    DashboardModule,
    AccessControlManagementModule,
    HttpClientModule,
    TranslateModule.forRoot({
      loader: {
        provide: TranslateLoader,
        useFactory: CustomMultiTranslateHttpLoaderFactory,
        deps: [HttpBackend, HttpClient, ConfigService, LocalizationService],
      },
    }),
    TranslationManagementModule,
    TaskManagementModule,
    ZgwModule,
    LoggingModule
  ],
  providers: [{
    provide: PLUGINS_TOKEN,
    useValue: [
      openZaakPluginSpecification,
      smartDocumentsPluginSpecification,
      besluitenApiPluginSpecification,
      documentenApiPluginSpecification,
      zakenApiPluginSpecification,
      objectenApiPluginSpecification,
      objecttypenApiPluginSpecification,
      objectTokenAuthenticationPluginSpecification,
      catalogiApiPluginSpecification,
      notificatiesApiPluginSpecification,
      openNotificatiesPluginSpecification,
      portaaltaakPluginSpecification,
      verzoekPluginSpecification
    ]
  }],
  bootstrap: [AppComponent]
})
export class AppModule {
  constructor(injector: Injector) {
    enableCustomFormioComponents(injector)
    registerFormioCurrencyComponent(injector);
    registerFormioUploadComponent(injector);
    registerFormioFileSelectorComponent(injector);
    registerDocumentenApiFormioUploadComponent(injector);
    registerFormioValueResolverSelectorComponent(injector);
  }
}
