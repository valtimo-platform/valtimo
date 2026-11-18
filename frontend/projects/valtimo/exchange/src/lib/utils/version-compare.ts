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

import {ExchangeCompatibility} from '../models';

const VERSION_PATTERN = /^(\d+)(?:\.(\d+))?(?:\.(\d+))?$/;

const parse = (version: string | null | undefined): Array<number> | null => {
  const core = version?.trim().split('-')[0].split('+')[0];
  if (!core) return null;

  const match = VERSION_PATTERN.exec(core);
  if (!match) return null;

  return [match[1], match[2], match[3]].map(part => (part === undefined ? 0 : Number(part)));
};

/** Numeric major[.minor[.patch]]; suffixes are ignored and missing parts count as 0. */
const compareValtimoVersions = (
  artifactVersion: string | null | undefined,
  runningVersion: string | null | undefined
): ExchangeCompatibility => {
  const artifact = parse(artifactVersion);
  const running = parse(runningVersion);
  if (!artifact || !running) return 'UNKNOWN';

  const differing = artifact.findIndex((part, index) => part !== running[index]);

  return differing !== -1 && artifact[differing] > running[differing] ? 'NEWER' : 'COMPATIBLE';
};

export {compareValtimoVersions};
