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

import {InjectionToken} from '@angular/core';
import {DataSourceSpecification, DisplayTypeSpecification} from '../models';

const DISPLAY_TYPE_TOKEN = new InjectionToken<DisplayTypeSpecification | null>(
  'Supported display types'
);

const DATA_SOURCE_TOKEN = new InjectionToken<DataSourceSpecification | null>(
  'Supported data sources'
);

export {DISPLAY_TYPE_TOKEN, DATA_SOURCE_TOKEN};
