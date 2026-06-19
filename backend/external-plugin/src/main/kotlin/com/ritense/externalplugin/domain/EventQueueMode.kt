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

package com.ritense.externalplugin.domain

/**
 * How the plugin-host declares its per-host RabbitMQ queue.
 *
 * - [LIVE]: queue is `durable:false, autoDelete:true`. The queue evaporates when the host
 *   disconnects, so events published while the host is fully down are lost. Low overhead;
 *   the default for new and pre-existing hosts.
 * - [DURABLE]: queue is `durable:true, autoDelete:false` with an `x-expires` (queue inactivity
 *   TTL) argument. The queue survives host restarts and accumulates events while the host is
 *   gone, up to the configured TTL since the last consumer disconnected.
 */
enum class EventQueueMode { LIVE, DURABLE }
