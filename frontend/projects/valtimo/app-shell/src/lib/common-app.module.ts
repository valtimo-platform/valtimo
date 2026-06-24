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
import {AccessControlManagementModule} from '@valtimo/access-control-management';
import {AccountModule} from '@valtimo/account';
import {AdminSettingsModule} from '@valtimo/admin-settings';
import {AnalyseModule} from '@valtimo/analyse';
import {BootstrapModule} from '@valtimo/bootstrap';
import {BuildingBlockManagementModule} from '@valtimo/building-block-management';
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
  VerzoekPluginModule,
  ZakenApiPluginModule,
} from '@valtimo/plugin';
import {PluginManagementModule} from '@valtimo/plugin-management';
import {ProcessModule} from '@valtimo/process';
import {ProcessLinkModule} from '@valtimo/process-link';
import {ProcessManagementModule} from '@valtimo/process-management';
import {ResourceModule} from '@valtimo/resource';
import {SecurityModule} from '@valtimo/security';
import {SwaggerModule} from '@valtimo/swagger';
import {TaskModule} from '@valtimo/task';
import {TeamsModule} from '@valtimo/teams';
import {registerDocumentenApiFormioUploadComponent, ZgwModule} from '@valtimo/zgw';

// Modules shared by every Valtimo application variant. Variants supply their
// own ConfigModule.forRoot(env) / LoggerModule.forRoot(env.logger) /
// CaseModule.forRoot(tabsFactory) / environment.authentication.module /
// TranslateModule.forRoot(...) / PLUGINS_TOKEN provider — anything that needs
// the per-variant `environment` constant or per-variant tabs/plugin spec list
// stays in the variant's own AppModule. Variant-only modules
// (FormIoModule, UploaderModule, SseModule, etc.) also stay variant-local.
const COMMON_IMPORTS = [
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
];

@NgModule({
  imports: COMMON_IMPORTS,
  exports: COMMON_IMPORTS,
})
export class CommonAppModule {
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
