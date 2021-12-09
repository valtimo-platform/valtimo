/*
 * Copyright 2015-2020 Ritense BV, the Netherlands.
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

import {CommonModule} from '@angular/common';
import {NgModule} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {NgbPaginationModule} from '@ng-bootstrap/ng-bootstrap';
import {TranslateModule} from '@ngx-translate/core';
import {CardModule} from '../card/card.module';
import {ListComponent} from './list.component';
import {ListFilterPipe} from './ListFilterPipe.directive';

@NgModule({
  declarations: [ListComponent, ListFilterPipe],
  imports: [CommonModule, CardModule, NgbPaginationModule, FormsModule, TranslateModule],
  exports: [ListComponent, ListFilterPipe]
})
export class ListModule {}
