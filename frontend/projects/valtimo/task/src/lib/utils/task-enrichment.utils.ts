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

import {TaskProcessLinkResult} from '@valtimo/process-link';
import {Task} from '../models';

/**
 * Enriches a task with assignee and due date from a process link result,
 * only filling in fields that are missing on the task itself.
 * Returns a new task object if any fields were enriched, or the original task if unchanged.
 */
export function enrichTaskFromProcessLink(
  task: Task,
  processLink: TaskProcessLinkResult | null | undefined
): Task {
  if (!processLink) return task;

  const needsAssignee = processLink.assignee && !task.assignee;
  const needsDue = processLink.due && !task.due;

  if (!needsAssignee && !needsDue) return task;

  return {
    ...task,
    ...(needsAssignee && {assignee: processLink.assignee}),
    ...(needsDue && {due: processLink.due}),
  };
}
