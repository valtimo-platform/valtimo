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

import {StringTypeConverter} from './stringTypeConverter';
import {BooleanTypeConverter} from './booleanTypeConverter';
import {DateTypeConverter} from './dateTypeConverter';
import {EnumTypeConverter} from './enumTypeConverter';
import {StringReplaceUnderscoreTypeConverter} from './stringReplaceUnderscoreTypeConverter';
import {RelatedFilesTypeConverter} from './relatedFilesTypeConverter';

const stringTypeConverter = new StringTypeConverter();
const booleanTypeConverter = new BooleanTypeConverter();
const dateTypeConverter = new DateTypeConverter();
const enumTypeConverter = new EnumTypeConverter();
const stringReplaceUnderscoreTypeConverter = new StringReplaceUnderscoreTypeConverter();
const relatedFilesTypeConverter = new RelatedFilesTypeConverter();

// TODO: Via injection
export const TYPE_CONVERTERS: Array<TypeConverter> = [
  stringTypeConverter,
  booleanTypeConverter,
  dateTypeConverter,
  enumTypeConverter,
  stringReplaceUnderscoreTypeConverter,
  relatedFilesTypeConverter
];

export interface TypeConverter {
  getTypeString(): string;

  convert(value: any, definition: any): string;
}
