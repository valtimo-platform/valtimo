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

import type { DbPool } from "./index.js";

/** A GZAC instance that has announced itself, and the browser origins it allows to frame plugins. */
export interface GzacInstance {
  gzacBaseUrl: string;
  frontendOrigins: string[];
}

/**
 * Stores which GZAC instances may embed this host's plugin screens, and from which browser origins.
 *
 * Keyed by `gzacBaseUrl` — the same identity a configuration push carries — so one GZAC re-announcing
 * itself (on every discovery poll) updates its row instead of accumulating duplicates.
 */
export class GzacInstanceRepository {
  constructor(private pool: DbPool) {}

  async upsert(gzacBaseUrl: string, frontendOrigins: string[]): Promise<void> {
    await this.pool.query(
      `INSERT INTO gzac_instances (gzac_base_url, frontend_origins, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (gzac_base_url) DO UPDATE SET
        frontend_origins = EXCLUDED.frontend_origins,
        updated_at = NOW()`,
      [gzacBaseUrl, JSON.stringify(frontendOrigins)]
    );
  }

  /**
   * Instances that announced themselves within the last `staleMs`. There is no deregistration call,
   * so this window is what eventually drops a GZAC that was decommissioned or repointed: it simply
   * stops re-announcing and ages out of the allowlist.
   */
  async listFresh(staleMs: number): Promise<GzacInstance[]> {
    const { rows } = await this.pool.query(
      `SELECT gzac_base_url, frontend_origins
       FROM gzac_instances
       WHERE updated_at > NOW() - ($1::bigint * INTERVAL '1 millisecond')
       ORDER BY gzac_base_url`,
      [staleMs]
    );
    return rows.map((row: Record<string, unknown>) => ({
      gzacBaseUrl: row.gzac_base_url as string,
      frontendOrigins: (row.frontend_origins as string[] | null) ?? [],
    }));
  }
}
