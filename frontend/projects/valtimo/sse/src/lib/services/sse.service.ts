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

import {Injectable} from '@angular/core';
import {filter, Observable, Subject, Subscription} from 'rxjs';
import {
  BaseSseEvent,
  EstablishedConnectionSseEvent,
  SseEventListener,
  SseEventType,
} from '../models/sse-events.model';
import {ConfigService} from '@valtimo/config';
import {
  SseErrorBucket,
  SseEventSubscriptionBucket,
  SseSubscriptionBucket,
} from '../models/sse-bucket.model';
import {NGXLogger} from 'ngx-logger';

/**
 * Server-side events service, for connecting and reconnecting to SSE,
 * and a translation layer between SSE json string data and TS typed events.
 *
 * The service is always present, and so events can be registered with {@link onMessage} and {@link onEvent},
 * and will not be lost on disconnect or reconnect of the SSE connection itself.
 * It is expected to also unregister events using the off-method variants of the on-method listeners.
 *
 * To ensure messages are received the connection must be explicitly opened with {@link connect},
 * likewise the connection should also be closed with {@link disconnect} to stop receiving messages.
 *
 * This service can reconnect itself with the backend, and might use the {@link subscriptionId} to ask for its
 * previous connection state. This state currently exists in the backend as the "Subscriber" class, and might
 * have a state containing queues of items that need to be sent, so you can reconnect and receive the rest.
 *
 * At this time no state data is kept, so reconnection without a subscriptionId does not give a different result
 */
@Injectable({
  providedIn: 'root',
})
export class SseService {
  private static readonly CONNECTION_RETRIES_EXCEEDED = -1;
  private static readonly NOT_CONNECTED = 0;
  private static readonly CONNECTING = 1;
  private static readonly RECONNECTING = 2;
  private static readonly CONNECTED = 10;

  private readonly VALTIMO_ENDPOINT_URL: string;
  private connectionCount = 0; // amount of times we have connected sequentially, no concurrent connections
  private establishedDataHandler?: Subscription = null;
  private establishedConnection?: EventSource = null;
  private establishedConnectionObservable: Observable<MessageEvent<BaseSseEvent>> = null;
  private subscriptionId?: string = null;
  private sequentialConnectionAttemptFailCount = 0;

  private errorBucket = new SseErrorBucket();
  private anySubscribersBucket = new SseSubscriptionBucket<BaseSseEvent>();
  private eventSubscribersBuckets: SseEventSubscriptionBucket<BaseSseEvent>[] = [];

  private state: number = SseService.NOT_CONNECTED;

  private _sseMessages$ = new Subject<MessageEvent<BaseSseEvent>>();

  get sseMessages$(): Observable<MessageEvent<BaseSseEvent>> {
    return this._sseMessages$.asObservable().pipe(filter(message => !!message));
  }

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: NGXLogger
  ) {
    this.VALTIMO_ENDPOINT_URL = configService.config.valtimoApi.endpointUri;
    this.connect();
  }

  getSseMessagesObservableByEventType(
    eventTypes: Array<SseEventType>
  ): Observable<MessageEvent<BaseSseEvent>> {
    return this._sseMessages$.asObservable().pipe(
      filter(message => !!message),
      filter(message => eventTypes.includes(message?.data?.eventType))
    );
  }

  /**
   * Start receiving SSE events
   */
  private connect() {
    this.ensureConnection();
    return this;
  }

  private onMessage(listener: SseEventListener<BaseSseEvent>) {
    this.ensureConnection(); // ensure connection
    this.anySubscribersBucket.on(listener);
    return this;
  }

  private onEvent<T extends BaseSseEvent>(event: string, listener: SseEventListener<T>) {
    this.ensureConnection(); // ensure connection
    let found = false;
    this.eventSubscribersBuckets.forEach(bucket => {
      if (bucket.event === event) {
        bucket.on(listener);
        found = true;
      }
    });
    if (!found) {
      const bucket = new SseEventSubscriptionBucket(event);
      bucket.on(listener);
      this.eventSubscribersBuckets.push(bucket);
    }
    return this;
  }

  private offMessage(listener: SseEventListener<BaseSseEvent>) {
    this.anySubscribersBucket.off(listener);
  }

  private offEvent(event: string, listener: SseEventListener<any>) {
    this.eventSubscribersBuckets.forEach(bucket => {
      if (bucket.event === event) {
        bucket.off(listener);
      }
    });
  }

  private offEvents(type?: string) {
    this.eventSubscribersBuckets.forEach(bucket => {
      if (type === null || type === bucket.event) {
        bucket.offAll();
      }
    });
  }

  private offMessages() {
    this.anySubscribersBucket.offAll();
  }

  private offAll() {
    this.offEvents();
    this.offMessages();
  }

  private disconnect(keepSubscriptionId: boolean = false) {
    this.disconnectWith(SseService.NOT_CONNECTED, keepSubscriptionId);
  }

  private disconnectWith(state: number, keepSubscriptionId: boolean = false) {
    this.state = state;
    if (this.establishedConnection?.readyState !== EventSource.CLOSED) {
      this.establishedConnection?.close();
    }
    this.establishedDataHandler.unsubscribe();
    this.establishedConnection = null;
    this.establishedConnectionObservable = null;
    this.establishedDataHandler = null;
    if (!keepSubscriptionId) {
      this.subscriptionId = null;
    }
  }

  private ensureConnection(retry: boolean = false) {
    if (this.establishedConnection !== null && this.establishedConnectionObservable !== null) {
      if (this.establishedConnection.readyState !== EventSource.CLOSED) {
        return; // found
      }
    }
    if (this.state === SseService.CONNECTING || this.state === SseService.RECONNECTING) {
      return; // already connecting
    }
    this.establishedConnection = null;
    this.establishedConnectionObservable = null;

    this.constructNewSse(retry); // create new
  }

  private constructNewSse(retry: boolean) {
    this.logger.debug('subscribing to sse events');
    if (this.connectionCount > 0) {
      this.state = SseService.RECONNECTING;
    } else {
      this.state = SseService.CONNECTING;
    }
    const observable = new Observable<MessageEvent<BaseSseEvent>>(observer => {
      const eventSource = this.getEventSource();
      eventSource.onopen = () => {
        this.establishedConnection = eventSource;
        this.logger.debug('connected to sse');
        this.connectionCount++;
        this.sequentialConnectionAttemptFailCount = 0; // reset retry count
        this.state = SseService.CONNECTED;
      };
      eventSource.onmessage = event => {
        observer.next({
          ...event, // forward event object but replace data field
          data: JSON.parse(event.data), // parse JSON string to JSON object
        });
      };
      eventSource.onerror = () => {
        eventSource.close();
        observer.complete();
        if (retry) {
          this.sequentialConnectionAttemptFailCount++;
          this.logger.debug(`retry failed: ${this.sequentialConnectionAttemptFailCount}`);
          if (this.sequentialConnectionAttemptFailCount > 3) {
            this.disconnectWith(SseService.CONNECTION_RETRIES_EXCEEDED, false);
            this.err(
              `Failed to connect to SSE after ${this.sequentialConnectionAttemptFailCount} retries`
            );
            return;
          }
        }
        this.disconnect(true);
        this.ensureConnection(true);
      };
      return () => eventSource.close();
    });
    this.establishedConnectionObservable = observable;
    this.registerSseEventHandling(observable);
    return observable;
  }

  private getEventSource() {
    let suffix = '';
    if (this.subscriptionId != null) {
      suffix = '/' + this.subscriptionId;
    }
    // subscribe to /sse or /sse/<subscriptionId>
    return new EventSource(this.VALTIMO_ENDPOINT_URL + 'v1/sse' + suffix);
  }

  private registerSseEventHandling(observable: Observable<MessageEvent<BaseSseEvent>>) {
    this.establishedDataHandler = observable.subscribe(event => {
      this._sseMessages$.next(event);
      this.internalListenerEstablishConnection(event);
      // notify all generic listeners
      this.anySubscribersBucket.sendEvent(event.data);
      // notify the specific event listener bucket
      this.eventSubscribersBuckets.forEach(bucket => {
        if (bucket.event === event?.data?.eventType) {
          bucket.sendEvent(event.data);
        }
      });
    });
  }

  private internalListenerEstablishConnection(event: MessageEvent<BaseSseEvent>) {
    if (event?.data?.eventType !== 'ESTABLISHED_CONNECTION') {
      return;
    }
    this.logger.debug(`established connection: ${event}`);
    this.subscriptionId = (event.data as EstablishedConnectionSseEvent).subscriptionId;
  }

  private err(message: string, ...data: any) {
    this.errorBucket.sendEvent({
      state: this.state,
      message,
      data,
    });
  }
}
