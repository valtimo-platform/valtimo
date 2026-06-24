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

import {NgModule} from '@angular/core';
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

import {CommonAppModule} from '@valtimo/app-shell';
import {
  CaseDetailTabAuditComponent,
  CaseDetailTabDocumentsComponent,
  CaseDetailTabNotesComponent,
  CaseDetailTabProgressComponent,
  CaseDetailTabSummaryComponent,
  CaseModule,
  DefaultTabs,
} from '@valtimo/case';
import {FormIoModule, UploaderModule} from '@valtimo/components';
import {FormViewModelModule} from '@valtimo/form-view-model';
import {
  besluitenApiPluginSpecification,
  catalogiApiPluginSpecification,
  documentenApiPluginSpecification,
  documentenApiPreviewPluginSpecification,
  KlantinteractiesApiPluginModule,
  klantinteractiesApiPluginSpecification,
  notificatiesApiPluginSpecification,
  objectenApiPluginSpecification,
  objectTokenAuthenticationPluginSpecification,
  objecttypenApiPluginSpecification,
  OpenKlantTokenAuthenticationPluginModule,
  openKlantTokenAuthenticationPluginSpecification,
  openNotificatiesPluginSpecification,
  openZaakPluginSpecification,
  PLUGINS_TOKEN,
  portaaltaakPluginSpecification,
  smartDocumentsPluginSpecification,
  verzoekPluginSpecification,
  zakenApiPluginSpecification,
} from '@valtimo/plugin';
import {
  ConfigModule,
  ConfigService,
  CustomMultiTranslateHttpLoaderFactory,
  LocalizationService,
} from '@valtimo/shared';

import {devDeclarations, devImports, devProviders, devTabs} from './dev-tools';
import {pluginImports, pluginSpecifications} from './app-plugins';

export function tabsFactory() {
  return new Map<string, object>([
    [DefaultTabs.summary, CaseDetailTabSummaryComponent],
    [DefaultTabs.progress, CaseDetailTabProgressComponent],
    [DefaultTabs.audit, CaseDetailTabAuditComponent],
    [DefaultTabs.documents, CaseDetailTabDocumentsComponent],
    [DefaultTabs.notes, CaseDetailTabNotesComponent],
    ...(environment.production ? [] : devTabs),
  ]);
}

@NgModule({
  declarations: [AppComponent, ...(environment.production ? [] : devDeclarations)],
  bootstrap: [AppComponent],
  imports: [
    BrowserModule,
    CommonModule,
    AppRoutingModule,
    FormsModule,
    ReactiveFormsModule,
    CommonAppModule,
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
    // dev-only feature modules
    FormIoModule,
    UploaderModule,
    FormViewModelModule,
    KlantinteractiesApiPluginModule,
    OpenKlantTokenAuthenticationPluginModule,
    ...pluginImports,
    ...(environment.production ? [] : devImports),
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
        klantinteractiesApiPluginSpecification,
        notificatiesApiPluginSpecification,
        objectenApiPluginSpecification,
        objectTokenAuthenticationPluginSpecification,
        objecttypenApiPluginSpecification,
        openKlantTokenAuthenticationPluginSpecification,
        openNotificatiesPluginSpecification,
        openZaakPluginSpecification,
        portaaltaakPluginSpecification,
        smartDocumentsPluginSpecification,
        zakenApiPluginSpecification,
        verzoekPluginSpecification,
        ...pluginSpecifications,
      ],
    },
    ...(environment.production ? [] : devProviders),
  ],
})
export class AppModule {}
