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

import {HttpClient} from '@angular/common/http';
import * as angularcore from '@angular/core';
import {Injectable, Injector, createNgModule, NgModule} from '@angular/core';
import {CASE_MANAGEMENT_TAB_TOKEN, ConfigService} from '@valtimo/config';
import * as rxjs from 'rxjs';
import {Observable, Subject} from 'rxjs';
import {ExtensionListItem} from '../models';
import * as valtimoplugin from '@valtimo/plugin';
import {PLUGINS_TOKEN, PluginService} from '@valtimo/plugin';
import * as angularcommon from '@angular/common';
import * as valtimocomponents from '@valtimo/components';
import * as tslib from 'tslib';
import {NGXLogger} from 'ngx-logger';
import {TabService} from '@valtimo/dossier-management';

@Injectable({providedIn: 'root'})
export class ExtensionService {
  private readonly valtimoEndpointUri: string;
  private readonly extensionImports = {
    '@angular/common': angularcommon,
    '@angular/core': angularcore,
    '@valtimo/components': valtimocomponents,
    '@valtimo/plugin': valtimoplugin,
    rxjs: rxjs,
    tslib: tslib,
  };
  private readonly extensionFrontendInitJs = 'frontend-bundle.js';

  constructor(
    private readonly configService: ConfigService,
    private readonly http: HttpClient,
    private readonly pluginService: PluginService,
    private readonly tabService: TabService,
    private readonly _injector: Injector,
    private readonly logger: NGXLogger
  ) {
    this.valtimoEndpointUri = `${this.configService.config.valtimoApi.endpointUri}`;
  }

  public loadAll() {
    this.getExtensionIds('STARTED', this.extensionFrontendInitJs).subscribe(extensionIds =>
      extensionIds.forEach(extensionId =>
        this.load(extensionId).subscribe(null, err => {
          throw new Error(err);
        })
      )
    );
  }

  public load(extensionId: string): Observable<any> {
    const subject = new Subject<any>();
    Object.keys(this.extensionImports).forEach(key => (window[key] = this.extensionImports[key]));
    import(
      /* webpackIgnore: true */ this.getFileUrl(extensionId, this.extensionFrontendInitJs)
    ).then(
      importedFile => {
        try {
          Object.keys(importedFile).forEach(name => {
            if (name?.endsWith('Module')) {
              this.loadModule(importedFile[name]);
            }
          });
          this.logger.debug(`Successfully loaded extension '${extensionId}'`);
          subject.next(true);
        } catch (err) {
          this.logger.error(`Failed to load extension '${extensionId}'.`, err);
          subject.error(err);
        }
      },
      err => {
        this.logger.error(`Failed to load extension '${extensionId}'.`, err);
        subject.error(err);
      }
    );
    return subject;
  }

  private loadModule(module: NgModule) {
    createNgModule<NgModule>(module as any, this._injector);
    const providers = Reflect.getOwnPropertyDescriptor(module, '__annotations__').value.flatMap(
      annotation => (annotation.providers ? annotation.providers : [])
    );
    providers
      .filter(provider => provider.provide == PLUGINS_TOKEN)
      .flatMap(provider => provider.useValue)
      .forEach(pluginSpecification =>
        this.pluginService.addPluginSpecification(pluginSpecification)
      );
    providers
      .filter(provider => provider.provide == CASE_MANAGEMENT_TAB_TOKEN)
      .flatMap(provider => provider.useValue)
      .forEach(caseManagementTab => this.tabService.addCaseManagementTab(caseManagementTab));
  }

  public getExtensions(): Observable<Array<ExtensionListItem>> {
    return this.http.get<Array<ExtensionListItem>>(
      `${this.valtimoEndpointUri}management/v1/extension`
    );
  }

  public installExtension(extensionId: string, version: string): Observable<void> {
    return this.http.post<void>(
      `${this.valtimoEndpointUri}management/v1/extension/${extensionId}/install/${version}`,
      null
    );
  }

  public updateExtension(extensionId: string, toVersion: string): Observable<void> {
    return this.http.post<void>(
      `${this.valtimoEndpointUri}management/v1/extension/${extensionId}/update/${toVersion}`,
      null
    );
  }

  public uninstallExtension(extensionId: string): Observable<void> {
    return this.http.delete<void>(
      `${this.valtimoEndpointUri}management/v1/extension/${extensionId}`
    );
  }

  public getExtensionIds(state: string, file: string): Observable<Array<string>> {
    return this.http.get<Array<string>>(
      `.${this.valtimoEndpointUri}v1/public/extension/id?state=${state}&file=${file}`
    );
  }

  public getFileUrl(extensionId: string, file: string): string {
    return `${location.origin}${this.valtimoEndpointUri}v1/public/extension/${extensionId}/file/${file}`;
  }

  public getFile(file: string, extensionId: string): Observable<string> {
    return this.http.get<string>(
      `${this.valtimoEndpointUri}v1/public/extension/${extensionId}/file/${file}`
    );
  }
}
