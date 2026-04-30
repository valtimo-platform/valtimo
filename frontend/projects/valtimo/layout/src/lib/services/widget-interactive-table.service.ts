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
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {Injectable} from '@angular/core';
import {FormArray, FormBuilder, FormGroup, Validators} from '@angular/forms';
import {HttpClient} from '@angular/common/http';
import {DocumentService} from '@valtimo/document';
import {Observable, of} from 'rxjs';
import {catchError} from 'rxjs/operators';
import {FilterDropdownDataProvider, WidgetDropdownValue} from '../models';
import {WidgetContext} from '../models/widget.model';
import {ConfigService} from '@valtimo/shared';

@Injectable({
  providedIn: 'root',
})
export class WidgetInteractiveTableService {
  constructor(
    private readonly documentService: DocumentService,
    private readonly httpClient: HttpClient,
    private readonly configService: ConfigService,
    private readonly fb: FormBuilder
  ) {}

  public getDropdownDataProviders(): Observable<Array<string>> {
    return this.documentService.getDropdownDataProviders();
  }

  public supportsDropdownValueUpdates(providerId: string | null | undefined): boolean {
    return providerId === FilterDropdownDataProvider.DATABASE;
  }

  public getDropdownValues(provider: string, dropdownKey: string): Observable<WidgetDropdownValue | null> {
    if (!provider || !dropdownKey) return of(null);

    return this.httpClient
      .get<WidgetDropdownValue>(this.getDropdownListUrl(provider, dropdownKey))
      .pipe(catchError(() => of(null)));
  }

  public saveDropdownValues(
    provider: string,
    dropdownKey: string,
    dropdownValues: WidgetDropdownValue
  ): Observable<object> {
    if (!provider || !dropdownKey || !Object.keys(dropdownValues ?? {}).length) return of({});

    return this.httpClient.post<object>(
      this.getDropdownListUrl(provider, dropdownKey),
      dropdownValues
    );
  }

  public deleteDropdownValues(provider: string, dropdownKey: string): Observable<object> {
    if (!provider || !dropdownKey) return of({});

    return this.httpClient.delete<object>(this.getDropdownListUrl(provider, dropdownKey));
  }

  public buildDropdownDataKey(
    context: WidgetContext | null,
    params: unknown,
    filterKey: string | null | undefined
  ): string | null {
    if (!filterKey) return null;

    if (context === 'case' && this.isCaseParams(params)) {
      return `${params.caseDefinitionKey}_${filterKey}`;
    }

    if (context === 'iko' && this.isIkoParams(params)) {
      return params.actionKey
        ? `${params.aggregateKey}_${params.actionKey}_${filterKey}`
        : null;
    }

    return null;
  }

  public createDropdownValuesFormArray(
    values?: WidgetDropdownValue | Array<{key: string; value: string}>
  ): FormArray<FormGroup> {
    const entries = Array.isArray(values)
      ? values.map(({key, value}) => [key, value] as [string, string])
      : Object.entries(values ?? {});

    const controls = entries.map(([key, value]) => this.createDropdownValueGroup(key, value));

    return this.fb.array<FormGroup>(controls.length ? controls : [this.createDropdownValueGroup()]);
  }

  public createDropdownValueGroup(key = '', value = ''): FormGroup {
    return this.fb.group({
      key: this.fb.control<string>(key, Validators.required),
      value: this.fb.control<string>(value, Validators.required),
    });
  }

  public mapDropdownValuesArrayToObject(
    dropdownValues: {key: string; value: string}[] | null | undefined
  ): WidgetDropdownValue | null {
    if (!dropdownValues?.length) return null;

    return dropdownValues.reduce<WidgetDropdownValue>(
      (acc, value) =>
        value?.key && value?.value ? {...acc, [value.key]: value.value} : acc,
      {}
    );
  }

  public isDropdownFieldType(fieldTypeId?: string | null): boolean {
    return ['single-select-dropdown', 'multi-select-dropdown'].includes(fieldTypeId ?? '');
  }

  private getDropdownListUrl(provider: string, dropdownKey: string): string {
    const key = encodeURI(dropdownKey);
    return `${this.configService.config.valtimoApi.endpointUri}v1/data/dropdown-list?provider=${provider}&key=${key}`;
  }

  private isCaseParams(
    params: unknown
  ): params is {caseDefinitionKey?: string; caseDefinitionVersionTag?: string} {
    return typeof params === 'object' && params !== null && 'caseDefinitionKey' in params;
  }

  private isIkoParams(params: unknown): params is {aggregateKey?: string; actionKey?: string} {
    return typeof params === 'object' && params !== null && 'aggregateKey' in params;
  }
}
