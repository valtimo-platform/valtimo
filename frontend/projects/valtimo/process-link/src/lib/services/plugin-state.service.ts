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

import {Injectable} from '@angular/core';
import {BehaviorSubject, combineLatest, Observable, of, Subject, switchMap} from 'rxjs';
import {catchError, map, take} from 'rxjs/operators';
import {
  ExternalPluginService,
  PluginConfiguration,
  PluginDefinition,
  PluginFunction,
  PluginManagementService,
  PluginService,
  toExternalPluginKey,
} from '@valtimo/plugin';
import {ProcessLink} from '../models';

@Injectable({
  providedIn: 'root',
})
export class PluginStateService {
  private readonly _selectedPluginDefinition$ = new BehaviorSubject<PluginDefinition>(undefined);
  private readonly _selectedPluginConfiguration$ = new BehaviorSubject<PluginConfiguration>(
    undefined
  );
  private readonly _selectedPluginFunction$ = new BehaviorSubject<PluginFunction>(undefined);
  private readonly _save$ = new Subject<null>();
  private readonly _selectedProcessLink$ = new BehaviorSubject<ProcessLink>(undefined);

  constructor(
    private readonly pluginManagementService: PluginManagementService,
    private readonly pluginService: PluginService,
    private readonly externalPluginService: ExternalPluginService
  ) {}

  get selectedPluginDefinition$(): Observable<PluginDefinition> {
    return this._selectedPluginDefinition$.asObservable();
  }

  get selectedPluginConfiguration$(): Observable<PluginConfiguration> {
    return this._selectedPluginConfiguration$.asObservable();
  }

  get selectedPluginFunction$(): Observable<PluginFunction> {
    return this._selectedPluginFunction$.asObservable();
  }

  get save$(): Observable<any> {
    return this._save$.asObservable();
  }

  get functionKey$(): Observable<string> {
    // Prioritize user-selected function, fall back to process link's saved action
    return this._selectedPluginFunction$.pipe(map(pluginFunction => pluginFunction?.key));
  }

  get pluginDefinitionKey$(): Observable<string> {
    return this._selectedProcessLink$.pipe(
      switchMap(selectedProcesLink =>
        !selectedProcesLink
          ? combineLatest([
              this._selectedPluginConfiguration$,
              this._selectedPluginDefinition$,
            ]).pipe(
              map(
                ([configuration, definition]) =>
                  configuration?.pluginDefinition.key || definition?.key
              )
            )
          : combineLatest([
              this._selectedProcessLink$,
              this.pluginService.pluginSpecifications$,
              this._selectedPluginDefinition$,
            ]).pipe(
              map(([processLink, pluginSpecifications, selectedDefinition]) => {
                if (processLink?.pluginDefinitionKey) {
                  return processLink.pluginDefinitionKey;
                }

                // For external plugins, use the definition set by loadExternalPluginStateForProcessLink
                if (selectedDefinition?.key) {
                  return selectedDefinition.key;
                }

                const pluginSpecification = pluginSpecifications.find(specification => {
                  const functionKeys =
                    specification?.functionConfigurationComponents &&
                    Object.keys(specification.functionConfigurationComponents);
                  return functionKeys?.includes(processLink?.pluginActionDefinitionKey);
                });

                return pluginSpecification?.pluginId;
              })
            )
      )
    );
  }

  selectPluginDefinition(definition: PluginDefinition): void {
    this._selectedPluginDefinition$.next(definition);
  }

  selectPluginConfiguration(configuration: PluginConfiguration | undefined): void {
    this._selectedPluginConfiguration$.next(configuration);
  }

  selectPluginFunction(pluginFunction: PluginFunction): void {
    this._selectedPluginFunction$.next(pluginFunction);
  }

  selectProcessLink(processLink: ProcessLink): void {
    this._selectedProcessLink$.next(processLink);

    // When editing a plugin process link, populate the plugin definition
    if (processLink?.processLinkType === 'plugin') {
      this.loadPluginDefinitionForProcessLink(processLink);
    } else if (
      processLink?.processLinkType === 'external_plugin' ||
      processLink?.processLinkType === 'external_plugin_task_form'
    ) {
      this.loadExternalPluginStateForProcessLink(processLink);
    }
  }

  private loadPluginDefinitionForProcessLink(processLink: ProcessLink): void {
    // Seed the wizard synchronously from what the link itself carries: the configuration
    // container only needs the key pair, and this service is a root singleton — waiting for the
    // definitions request below leaves the container evaluating with a previously edited link's
    // stale function/configuration until (or forever, if) that request completes.
    if (processLink.pluginActionDefinitionKey) {
      this._selectedPluginFunction$.next({
        key: processLink.pluginActionDefinitionKey,
      } as PluginFunction);
    }
    if (!processLink.pluginConfigurationId) {
      this._selectedPluginConfiguration$.next(undefined);
    }

    // Get the plugin definition key - either directly or from plugin specifications
    this.getPluginDefinitionKeyForProcessLink(processLink)
      .pipe(take(1))
      .subscribe(pluginDefinitionKey => {
        if (pluginDefinitionKey) {
          // Fetch all plugin definitions and find the one matching the key
          this.pluginManagementService
            .getPluginDefinitions()
            .pipe(
              take(1),
              map(definitions => definitions.find(d => d.key === pluginDefinitionKey)),
              catchError(() => of(undefined))
            )
            .subscribe(definition => {
              if (definition) {
                this._selectedPluginDefinition$.next(definition);
              }
            });
        }
      });

    // Load and set the plugin configuration if available
    if (processLink.pluginConfigurationId) {
      this.pluginManagementService
        .getAllPluginConfigurations()
        .pipe(
          take(1),
          map(configs => configs.find(c => c.id === processLink.pluginConfigurationId)),
          catchError(() => of(undefined))
        )
        .subscribe(configuration => {
          if (configuration) {
            this._selectedPluginConfiguration$.next(configuration);
          }
        });
    }
  }

  private loadExternalPluginStateForProcessLink(processLink: ProcessLink): void {
    // The "function" is a service-task action key, or — for a task-form link — the task-form
    // bundle key (empty string for the plugin's sole, unkeyed bundle) so the wizard's selection
    // matches the option listed in the action step. Seeded synchronously; see
    // loadPluginDefinitionForProcessLink for why.
    const functionKey =
      processLink.actionKey ??
      (processLink.processLinkType === 'external_plugin_task_form'
        ? (processLink.bundleKey ?? '')
        : undefined);
    if (functionKey !== undefined) {
      this._selectedPluginFunction$.next({key: functionKey} as PluginFunction);
    }

    const configId = processLink.externalPluginConfigurationId;
    if (!configId) {
      // A BUILDING_BLOCK reference carries no configuration — resolve the definition from the
      // link's pluginId (+ version when recorded) instead, and drop whatever configuration a
      // previously edited link left behind in this singleton.
      this._selectedPluginConfiguration$.next(undefined);
      const pluginId = processLink.pluginDefinitionKey;
      if (!pluginId) return;
      this.externalPluginService
        .getDefinitions()
        .pipe(
          take(1),
          catchError(() => of([]))
        )
        .subscribe(definitions => {
          const definition = definitions.find(
            d =>
              d.pluginId === pluginId &&
              (!processLink.pluginVersion || d.version === processLink.pluginVersion)
          );
          if (definition) {
            this._selectedPluginDefinition$.next({
              key: toExternalPluginKey(definition.id),
            } as PluginDefinition);
          }
        });
      return;
    }

    // Fetch all external configurations to find the one matching this process link
    this.externalPluginService
      .getConfigurations()
      .pipe(
        take(1),
        catchError(() => of([]))
      )
      .subscribe(configs => {
        const config = configs.find(c => c.id === configId);
        if (!config) return;

        const definitionId = config.definitionId;
        const externalKey = toExternalPluginKey(definitionId);

        // Set synthetic plugin definition with the external: prefix key
        this._selectedPluginDefinition$.next({key: externalKey} as PluginDefinition);

        // Set synthetic plugin configuration with the external config ID
        this._selectedPluginConfiguration$.next({
          id: configId,
          pluginDefinition: {key: externalKey},
        } as PluginConfiguration);
      });
  }

  private getPluginDefinitionKeyForProcessLink(processLink: ProcessLink): Observable<string> {
    // If the key is directly available, use it
    if (processLink.pluginDefinitionKey) {
      return of(processLink.pluginDefinitionKey);
    }

    // Otherwise, derive it from plugin specifications using the action key
    return this.pluginService.pluginSpecifications$.pipe(
      map(pluginSpecifications => {
        const pluginSpecification = pluginSpecifications.find(specification => {
          const functionKeys =
            specification?.functionConfigurationComponents &&
            Object.keys(specification.functionConfigurationComponents);
          return functionKeys?.includes(processLink.pluginActionDefinitionKey);
        });
        return pluginSpecification?.pluginId;
      })
    );
  }

  deselectProcessLink(): void {
    this._selectedProcessLink$.next(undefined);
  }

  save(): void {
    this._save$.next(null);
  }
}
