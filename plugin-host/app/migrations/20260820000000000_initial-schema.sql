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

-- Up Migration

CREATE TABLE plugin_configurations (
  configuration_id TEXT PRIMARY KEY,
  plugin_id TEXT NOT NULL,
  plugin_version TEXT NOT NULL,
  properties JSONB NOT NULL DEFAULT '{}',
  service_token TEXT NOT NULL,
  gzac_base_url TEXT NOT NULL,
  event_broker JSONB,
  event_subscriptions JSONB NOT NULL DEFAULT '[]',
  granted_capabilities JSONB NOT NULL DEFAULT '[]',
  granted_endpoints JSONB,
  allowed_egress JSONB NOT NULL DEFAULT '[]',
  owner_id TEXT,
  expected_content_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_plugin_configs_plugin ON plugin_configurations (plugin_id, plugin_version);
CREATE INDEX idx_plugin_configs_owner ON plugin_configurations (owner_id);

CREATE TABLE plugin_kv (
  configuration_id TEXT NOT NULL,
  key TEXT NOT NULL,
  value JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (configuration_id, key)
);

CREATE INDEX idx_plugin_kv_prefix ON plugin_kv (configuration_id, key text_pattern_ops);

CREATE TABLE plugin_logs (
  id BIGSERIAL PRIMARY KEY,
  configuration_id TEXT NOT NULL,
  plugin_id TEXT NOT NULL,
  plugin_version TEXT NOT NULL,
  level VARCHAR(8) NOT NULL,
  message TEXT NOT NULL,
  data JSONB,
  source VARCHAR(32) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_plugin_logs_config ON plugin_logs (configuration_id, created_at DESC);
CREATE INDEX idx_plugin_logs_level ON plugin_logs (configuration_id, level, created_at DESC);

CREATE TABLE gzac_instances (
  gzac_base_url TEXT PRIMARY KEY,
  frontend_origins JSONB NOT NULL DEFAULT '[]',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Down Migration

DROP TABLE gzac_instances;
DROP TABLE plugin_logs;
DROP TABLE plugin_kv;
DROP TABLE plugin_configurations;
