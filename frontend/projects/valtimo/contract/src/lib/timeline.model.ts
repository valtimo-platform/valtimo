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

export interface TimelineItem {
  date: string;
  time: string;
  user: string;
  activity: string;
  summaryTranslationKey: string;
  summaryTranslationParams: object;
}

export class TimelineItemImpl implements TimelineItem {
  private readonly _date: string;
  private readonly _time: string;
  private readonly _user: string;
  private readonly _activity: string;
  private readonly _summaryTranslationKey: string;
  private readonly _summaryTranslationParams: object;

  constructor(date: string, time: string, user: string, activity: string, summaryTranslationKey: string, summaryTranslationParams: object) {
    this._date = date;
    this._time = time;
    this._user = user;
    this._activity = activity;
    this._summaryTranslationKey = summaryTranslationKey;
    this._summaryTranslationParams = summaryTranslationParams;
  }

  get date(): string {
    return this._date;
  }

  get time(): string {
    return this._time;
  }

  get user(): string {
    return this._user;
  }

  get activity(): string {
    return this._activity;
  }

  get summaryTranslationKey(): string {
    return this._summaryTranslationKey;
  }

  get summaryTranslationParams(): object {
    return this._summaryTranslationParams;
  }

}
