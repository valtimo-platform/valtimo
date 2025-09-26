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

import {StringTypeConverter} from './stringTypeConverter';
import {BooleanTypeConverter} from './booleanTypeConverter';
import {DateTypeConverter} from './dateTypeConverter';
import {EnumTypeConverter} from './enumTypeConverter';
import {StringReplaceUnderscoreTypeConverter} from './stringReplaceUnderscoreTypeConverter';
import {RelatedFilesTypeConverter} from './relatedFilesTypeConverter';
import {NumberTypeConverter} from './numberTypeConverter';
import {InjectionToken} from '@angular/core';
import {PercentTypeConverter} from './percentTypeConverter';
import {CurrencyTypeConverter} from './currencyTypeConverter';

export const TYPE_CONVERTER_TOKEN = new InjectionToken<TypeConverter[]>('Type Converter');

export const TYPE_PROVIDERS = [
  {
    provide: TYPE_CONVERTER_TOKEN,
    useClass: StringTypeConverter,
    multi: true,
  },
  {
    provide: TYPE_CONVERTER_TOKEN,
    useClass: BooleanTypeConverter,
    multi: true,
  },
  {
    provide: TYPE_CONVERTER_TOKEN,
    useClass: DateTypeConverter,
    multi: true,
  },
  {
    provide: TYPE_CONVERTER_TOKEN,
    useClass: EnumTypeConverter,
    multi: true,
  },
  {
    provide: TYPE_CONVERTER_TOKEN,
    useClass: StringReplaceUnderscoreTypeConverter,
    multi: true,
  },
  {
    provide: TYPE_CONVERTER_TOKEN,
    useClass: RelatedFilesTypeConverter,
    multi: true,
  },
  {
    provide: TYPE_CONVERTER_TOKEN,
    useClass: NumberTypeConverter,
    multi: true,
  },
  {
    provide: TYPE_CONVERTER_TOKEN,
    useClass: PercentTypeConverter,
    multi: true,
  },
  {
    provide: TYPE_CONVERTER_TOKEN,
    useClass: CurrencyTypeConverter,
    multi: true,
  },
];

export interface TypeConverter {
  getTypeString(): string;

  convert(value: any, definition: any): string;
}
