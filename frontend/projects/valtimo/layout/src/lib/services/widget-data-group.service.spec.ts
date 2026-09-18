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
import {of, Subject, throwError} from 'rxjs';
import {BasicWidget, WidgetDataGroupResponse, WidgetType} from '../models';
import {WidgetDataGroupService} from './widget-data-group.service';

describe('WidgetDataGroupService', () => {
  let service: WidgetDataGroupService;
  let groupCalls: string[];
  let widgetCalls: string[];
  let groupResponse: WidgetDataGroupResponse;

  const widget = (key: string, dataGroupId?: string): BasicWidget =>
    ({
      type: WidgetType.FIELDS,
      title: key,
      key,
      width: 1,
      highContrast: false,
      displayConditions: [],
      dataGroupId,
    }) as BasicWidget;

  beforeEach(() => {
    groupCalls = [];
    widgetCalls = [];
    groupResponse = {
      first: {data: {value: 'one'}},
      second: {data: {value: 'two'}},
      third: {data: {value: 'three'}},
    };

    service = new WidgetDataGroupService();
    service.setSource({
      fetchGroup: group => {
        groupCalls.push(group);
        return of(groupResponse);
      },
      fetchWidget: widgetKey => {
        widgetCalls.push(widgetKey);
        return of({value: widgetKey});
      },
    });
  });

  it('should issue one request per distinct group', () => {
    service.setWidgets([widget('first', 'a'), widget('second', 'a'), widget('third', 'b')]);

    service.dataFor('first').subscribe();
    service.dataFor('second').subscribe();
    service.dataFor('third').subscribe();

    expect(groupCalls).toEqual(['a', 'b']);
    expect(widgetCalls).toEqual([]);
  });

  it('should hand every widget of a group its own data', () => {
    service.setWidgets([widget('first', 'a'), widget('second', 'a')]);
    const received: unknown[] = [];

    service.dataFor('first').subscribe(data => received.push(data));
    service.dataFor('second').subscribe(data => received.push(data));

    expect(received).toEqual([{value: 'one'}, {value: 'two'}]);
  });

  it('should not request a group no widget subscribes to', () => {
    service.setWidgets([widget('first', 'a'), widget('third', 'b')]);

    service.dataFor('first').subscribe();

    expect(groupCalls).toEqual(['a']);
  });

  it('should fall back to per-widget requests when dataGroupId is absent', () => {
    service.setWidgets([widget('first'), widget('second')]);
    const received: unknown[] = [];

    service.dataFor('first').subscribe(data => received.push(data));
    service.dataFor('second').subscribe(data => received.push(data));

    expect(groupCalls).toEqual([]);
    expect(widgetCalls).toEqual(['first', 'second']);
    expect(received).toEqual([{value: 'first'}, {value: 'second'}]);
  });

  it('should fall back for every widget when one lacks a dataGroupId', () => {
    service.setWidgets([widget('first', 'a'), widget('second')]);

    service.dataFor('first').subscribe();
    service.dataFor('second').subscribe();

    expect(groupCalls).toEqual([]);
    expect(widgetCalls).toEqual(['first', 'second']);
  });

  it('should emit null for a widget whose envelope holds an error', () => {
    groupResponse = {
      first: {data: {value: 'one'}},
      second: {error: {code: 'UPSTREAM_UNAVAILABLE'}},
    };
    service.setWidgets([widget('first', 'a'), widget('second', 'a')]);
    const received: unknown[] = [];

    service.dataFor('first').subscribe(data => received.push(data));
    service.dataFor('second').subscribe(data => received.push(data));

    expect(received).toEqual([{value: 'one'}, null]);
  });

  it('should fall back to per-widget requests when a group request fails', () => {
    service.setSource({
      fetchGroup: group => {
        groupCalls.push(group);
        return throwError(() => new Error('boom'));
      },
      fetchWidget: widgetKey => {
        widgetCalls.push(widgetKey);
        return of({value: widgetKey});
      },
    });
    service.setWidgets([widget('first', 'a'), widget('second', 'a')]);
    const received: unknown[] = [];

    service.dataFor('first').subscribe(data => received.push(data));
    service.dataFor('second').subscribe(data => received.push(data));

    expect(groupCalls).toEqual(['a']);
    expect(widgetCalls).toEqual(['first', 'second']);
    expect(received).toEqual([{value: 'first'}, {value: 'second'}]);
  });

  it('should refresh per widget after a group request failed', () => {
    service.setSource({
      fetchGroup: group => {
        groupCalls.push(group);
        return throwError(() => new Error('boom'));
      },
      fetchWidget: widgetKey => {
        widgetCalls.push(widgetKey);
        return of({value: widgetKey});
      },
    });
    service.setWidgets([widget('first', 'a'), widget('second', 'a')]);
    service.dataFor('first').subscribe();
    widgetCalls.length = 0;

    service.refresh();

    expect(groupCalls).toEqual(['a']);
    expect(widgetCalls).toEqual(['first', 'second']);
  });

  it('should emit null for a widget whose own request fails', () => {
    service.setSource({
      fetchGroup: () => of({}),
      fetchWidget: () => throwError(() => new Error('boom')),
    });
    service.setWidgets([widget('first')]);
    let received: unknown = 'untouched';

    service.dataFor('first').subscribe(data => (received = data));

    expect(received).toBeNull();
  });

  it('should drop a response that arrives after the widget list was replaced', () => {
    const responses: Subject<WidgetDataGroupResponse>[] = [];
    service.setSource({
      fetchGroup: () => {
        const response = new Subject<WidgetDataGroupResponse>();
        responses.push(response);
        return response;
      },
      fetchWidget: () => of(null),
    });
    service.setWidgets([widget('first', 'a')]);
    service.dataFor('first').subscribe();

    service.setWidgets([widget('first', 'b')]);
    let received: unknown = 'untouched';
    service.dataFor('first').subscribe(data => (received = data));
    responses[0].next({first: {data: {value: 'stale'}}});

    expect(received).toBe('untouched');
  });

  it('should drop a superseded request when the same group is refreshed twice', () => {
    const responses: Subject<WidgetDataGroupResponse>[] = [];
    service.setSource({
      fetchGroup: () => {
        const subject = new Subject<WidgetDataGroupResponse>();
        responses.push(subject);
        return subject;
      },
      fetchWidget: () => of(null),
    });
    service.setWidgets([widget('first', 'a')]);
    let received: unknown = 'untouched';
    service.dataFor('first').subscribe(data => (received = data));

    service.refresh();
    responses[0].next({first: {data: {value: 'stale'}}});
    responses[1].next({first: {data: {value: 'fresh'}}});

    expect(received).toEqual({value: 'fresh'});
  });

  it('should cancel in-flight requests on destroy', () => {
    const pending = new Subject<WidgetDataGroupResponse>();
    service.setSource({fetchGroup: () => pending, fetchWidget: () => of(null)});
    service.setWidgets([widget('first', 'a')]);
    service.dataFor('first').subscribe();

    service.ngOnDestroy();

    expect(pending.observed).toBeFalse();
  });

  it('should replay the last value to a late subscriber', () => {
    service.setWidgets([widget('first', 'a'), widget('second', 'a')]);
    service.dataFor('first').subscribe();

    let received: unknown = undefined;
    service.dataFor('second').subscribe(data => (received = data));

    expect(groupCalls).toEqual(['a']);
    expect(received).toEqual({value: 'two'});
  });

  it('should re-run requested groups on refresh, and only those', () => {
    service.setWidgets([widget('first', 'a'), widget('third', 'b')]);
    service.dataFor('first').subscribe();

    service.refresh();

    expect(groupCalls).toEqual(['a', 'a']);
  });

  it('should re-run per-widget requests on refresh', () => {
    service.setWidgets([widget('first'), widget('second')]);
    service.dataFor('first').subscribe();

    service.refresh();

    expect(widgetCalls).toEqual(['first', 'first']);
  });

  it('should request nothing before a widget list is set', () => {
    service.dataFor('first').subscribe();

    expect(groupCalls).toEqual([]);
    expect(widgetCalls).toEqual(['first']);
  });
});
