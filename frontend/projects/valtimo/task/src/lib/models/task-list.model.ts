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

import {ListItem} from 'carbon-components-angular/dropdown/list-item.interface';
import {TaskListTab} from '@valtimo/config';

interface TaskPageParams {
  page: number;
  size: number;
  collectionSize?: number;
  sort?: string;
}

enum TaskListColumnDefaultSort {
  ASC = 'ASC',
  DESC = 'DESC',
}

interface TaskListColumnEnum {
  [key: string]: string;
}

interface TaskListColumnDisplayTypeParameters {
  enum?: TaskListColumnEnum;
  dateFormat?: string;
}

interface TaskListColumnDisplayType {
  type: string;
  displayTypeParameters?: TaskListColumnDisplayTypeParameters;
}

interface TaskListColumn {
  title?: string;
  key: string;
  path: string;
  displayType: TaskListColumnDisplayType;
  sortable: boolean;
  defaultSort?: TaskListColumnDefaultSort;
  order?: number;
}

type TaskListColumnModalType = 'edit' | 'add';

type TaskListColumnModalCloseEvent = 'close' | 'refresh';

interface TaskListColumnListItem extends ListItem {
  key: string;
}

interface TaskListParams {
  params: {
    selectedTaskType: TaskListTab;
    params: TaskPageParams;
    caseDefinitionName?: string;
    reload: boolean;
  };
  enableLoadingAnimation: boolean;
}

export {
  TaskListColumn,
  TaskListColumnDisplayType,
  TaskListColumnDefaultSort,
  TaskListColumnModalType,
  TaskListColumnListItem,
  TaskListColumnModalCloseEvent,
  TaskListColumnDisplayTypeParameters,
  TaskListColumnEnum,
  TaskPageParams,
  TaskListParams,
};
