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
import {BehaviorSubject, Observable} from 'rxjs';
import {BasicWidget} from '../models';

export interface IWidgetManagementService<T> {
  params$: Observable<T | null>;
  valueResolverApi$: BehaviorSubject<string | null>;
  initParams(...params): void;
  getWidgetConfiguration(): Observable<BasicWidget[]>;
  updateWidgetConfiguration(widgets: BasicWidget[]): Observable<BasicWidget[]>;
  deleteWidget(widget: BasicWidget): Observable<void>;
  updateWidget(widget: BasicWidget): Observable<BasicWidget>;
  createWidget(widget: BasicWidget): Observable<BasicWidget>;
}
