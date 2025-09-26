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

import {Injectable} from '@angular/core';
import {
  TaskListEncodedQueryParams,
  TaskListQueryParams,
  TaskListQueryParamsWithReload,
} from '../models';
import {omit} from 'lodash';
import {ActivatedRoute, Router} from '@angular/router';

@Injectable()
export class TaskListQueryParamService {
  public setTaskListParams(params: TaskListQueryParamsWithReload): void {
    const queryParams: TaskListQueryParams = omit(params, 'reload');
    const encodedQueryParams = Object.keys(queryParams).reduce(
      (acc, curr) => ({...acc, [curr]: this.objectToBase64(queryParams[curr])}),
      {}
    ) as TaskListEncodedQueryParams;

    this.router.navigate([this.getUrlWithoutParams()], {queryParams: encodedQueryParams});
  }

  constructor(
    private readonly router: Router,
    private readonly route: ActivatedRoute
  ) {}

  public getTaskListQueryParams(): Partial<TaskListQueryParams> {
    const queryParams = this.route.snapshot.queryParams;
    const decodedParams = Object.keys(queryParams).reduce(
      (acc, curr) => ({...acc, [curr]: this.parseBase64(queryParams[curr])}),
      {}
    ) as Partial<TaskListQueryParams>;

    return decodedParams;
  }

  private getUrlWithoutParams(): string {
    const urlTree = this.router.parseUrl(this.router.url);
    urlTree.queryParams = {};
    urlTree.fragment = null;
    return urlTree.toString();
  }

  private objectToBase64(jsObject: object): string {
    return btoa(JSON.stringify(jsObject));
  }

  private parseBase64(base64string: string): object {
    return JSON.parse(atob(base64string));
  }
}
