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
import {Component, Input} from '@angular/core';
import {TimelineItem} from '../../models';

@Component({
  selector: 'valtimo-timeline',
  templateUrl: './timeline.component.html',
  styleUrls: ['./timeline.component.scss'],
})
export class TimelineComponent {
  @Input() items: Array<TimelineItem>;
  @Input() actions?: any[];

  public getSupportedActions(item: TimelineItem, actions: Array<any>): Array<any> {
    return (
      actions?.filter(action => {
        const actionId = action?.id;
        const itemSupportedActions = Array.isArray(item.supportedActionIds);

        if (actionId && itemSupportedActions) {
          return item.supportedActionIds.includes(actionId);
        }

        return true;
      }) || []
    );
  }
}
