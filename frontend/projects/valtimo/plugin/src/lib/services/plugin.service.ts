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

import {Inject, Injectable} from '@angular/core';
import {PluginConfig, PluginSpecification} from '../models';
import {BehaviorSubject, Observable} from 'rxjs';
import {map} from 'rxjs/operators';
import {PLUGINS_TOKEN} from '../constants';

@Injectable({
  providedIn: 'root',
})
export class PluginService {
  private readonly _pluginSpecifications$ = new BehaviorSubject<Array<PluginSpecification>>([]);
  private readonly _availablePluginIds$ = this._pluginSpecifications$.pipe(
    map(pluginSpecifications => pluginSpecifications.map(specification => specification.pluginId))
  );

  constructor(@Inject(PLUGINS_TOKEN) private readonly pluginConfig: PluginConfig) {
    this._pluginSpecifications$.next(pluginConfig);
  }

  get pluginSpecifications$(): Observable<Array<PluginSpecification>> {
    return this._pluginSpecifications$.asObservable();
  }

  get pluginSpecifications(): Array<PluginSpecification> {
    return this._pluginSpecifications$.getValue();
  }

  get availablePluginIds$(): Observable<Array<string>> {
    return this._availablePluginIds$;
  }
}
