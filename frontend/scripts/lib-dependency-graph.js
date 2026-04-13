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

/**
 * Parses the build order from package.json scripts (libs:build-N:* and libs:build:*)
 * and the libs-build-all command to derive the full dependency graph.
 *
 * The libs-build-all script determines whether each level is built sequentially (run-s)
 * or in parallel (run-p). For sequential levels, libraries within the level depend on
 * each other in the order they appear in package.json. For parallel levels, libraries
 * within the level have no mutual dependencies.
 *
 * Build levels from package.json:
 *   libs:build-1:*  -> level 1 (sequential)
 *   libs:build-2:*  -> level 2 (parallel)
 *   libs:build-3:*  -> level 3 (sequential)
 *   libs:build-4:*  -> level 4 (sequential)
 *   libs:build-5:*  -> level 5 (sequential)
 *   libs:build-6:*  -> level 6 (sequential)
 *   libs:build-7:*  -> level 7 (sequential)
 *   libs:build:*    -> level 8 (parallel, leaf libraries)
 */

const fs = require('fs');
const path = require('path');

const BUILD_SCRIPT_PATTERN = /^libs:build(-(\d+))?:(.+)$/;

/**
 * Parse the libs-build-all script to determine which levels use run-p (parallel)
 * and which use run-s (sequential).
 *
 * The script looks like:
 *   rimraf dist && run-s libs:build-1:* && run-p ... libs:build-2:* && run-s libs:build-3:* ...
 *
 * Returns a Map<number, 'parallel' | 'sequential'> for numbered levels,
 * plus a mode for the unnumbered libs:build:* group.
 */
function parseBuildModes(buildAllScript) {
  const modes = new Map();
  let leafMode = 'sequential';

  // Split on && to get each step
  const steps = buildAllScript.split('&&').map(s => s.trim());

  for (const step of steps) {
    // Check if this step references libs:build-N:* or libs:build:*
    const levelMatch = step.match(/libs:build-(\d+):\*/);
    const leafMatch = step.match(/(?:^|\s)libs:build:\*/);

    if (levelMatch) {
      const level = parseInt(levelMatch[1], 10);
      const isParallel = step.includes('run-p') || step.includes('-p');
      modes.set(level, isParallel ? 'parallel' : 'sequential');
    } else if (leafMatch) {
      const isParallel = step.includes('run-p') || step.includes('-p');
      leafMode = isParallel ? 'parallel' : 'sequential';
    }
  }

  return {modes, leafMode};
}

function parseBuildOrder(packageJsonPath) {
  const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const scriptNames = Object.keys(pkg.scripts);

  // Map: libName -> level number
  const libLevels = new Map();
  // Map: level number -> [libName, ...] (preserves order from package.json)
  const levels = new Map();

  let maxNumberedLevel = 0;

  for (const name of scriptNames) {
    const match = name.match(BUILD_SCRIPT_PATTERN);
    if (!match) continue;

    const levelStr = match[2]; // undefined for libs:build:*, digit string for libs:build-N:*
    const libName = match[3];

    // Skip non-library entries like copy-version
    if (libName === 'copy-version') continue;

    let level;
    if (levelStr) {
      level = parseInt(levelStr, 10);
      maxNumberedLevel = Math.max(maxNumberedLevel, level);
    } else {
      level = -1; // placeholder for leaf libs
    }

    // A library might appear in both libs:build-N and libs:build — the numbered one is the
    // authoritative build level; the unnumbered one is a "leaf" build.
    if (level !== -1) {
      libLevels.set(libName, level);
      if (!levels.has(level)) levels.set(level, []);
      levels.get(level).push(libName);
    } else if (!libLevels.has(libName)) {
      libLevels.set(libName, -1);
    }
  }

  // Assign unnumbered libs to level maxNumberedLevel + 1
  const leafLevel = maxNumberedLevel + 1;
  for (const [libName, level] of libLevels) {
    if (level === -1) {
      libLevels.set(libName, leafLevel);
      if (!levels.has(leafLevel)) levels.set(leafLevel, []);
      levels.get(leafLevel).push(libName);
    }
  }

  // Sort levels
  const sortedLevelNumbers = [...levels.keys()].sort((a, b) => a - b);

  // Parse parallel/sequential modes from libs-build-all script
  const buildAllScript = pkg.scripts['libs-build-all'] || '';
  const {modes: levelModes, leafMode} = parseBuildModes(buildAllScript);

  // Build the mode map including the leaf level
  const levelBuildModes = new Map();
  for (const levelNum of sortedLevelNumbers) {
    if (levelNum === leafLevel) {
      levelBuildModes.set(levelNum, leafMode);
    } else {
      levelBuildModes.set(levelNum, levelModes.get(levelNum) || 'sequential');
    }
  }

  return {libLevels, levels, sortedLevelNumbers, levelBuildModes};
}

/**
 * For parallel levels, scan TypeScript source files to detect actual import dependencies
 * between libraries at the same level. This catches hidden intra-level dependencies that
 * the package.json build order doesn't encode (e.g. bootstrap -> account at leaf level).
 */
function scanImportsForParallelLevels(levels, sortedLevelNumbers, levelBuildModes, frontendRoot) {
  const VALTIMO_IMPORT = /@valtimo\/([a-z-]+)/g;
  // intraLevelDeps: Map<libName, Set<libName>> — only for parallel levels
  const intraLevelDeps = new Map();

  for (const levelNum of sortedLevelNumbers) {
    if (levelBuildModes.get(levelNum) !== 'parallel') continue;

    const libsAtLevel = new Set(levels.get(levelNum));

    for (const libName of libsAtLevel) {
      const libSrcDir = path.join(frontendRoot, 'projects', 'valtimo', libName, 'src');
      if (!fs.existsSync(libSrcDir)) continue;

      const tsFiles = findTsFiles(libSrcDir);
      const deps = new Set();

      for (const file of tsFiles) {
        const content = fs.readFileSync(file, 'utf8');
        let match;
        VALTIMO_IMPORT.lastIndex = 0;
        while ((match = VALTIMO_IMPORT.exec(content)) !== null) {
          const depName = match[1];
          // Only track if the dependency is in the same parallel level
          if (depName !== libName && libsAtLevel.has(depName)) {
            deps.add(depName);
          }
        }
      }

      if (deps.size > 0) {
        intraLevelDeps.set(libName, deps);
      }
    }
  }

  return intraLevelDeps;
}

/**
 * Recursively find all .ts files in a directory (excluding spec files).
 */
function findTsFiles(dir) {
  const results = [];
  try {
    const entries = fs.readdirSync(dir, {withFileTypes: true});
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...findTsFiles(fullPath));
      } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.spec.ts')) {
        results.push(fullPath);
      }
    }
  } catch {
    // Ignore read errors
  }
  return results;
}

/**
 * Builds the dependency map.
 *
 * - Every library depends on ALL libraries at lower levels.
 * - For sequential levels, libraries also depend on earlier libraries within the same level
 *   (because run-s builds them in order).
 * - For parallel levels, source imports are scanned to detect hidden intra-level dependencies.
 */
function buildDependencyMap(libLevels, levels, sortedLevelNumbers, levelBuildModes, frontendRoot) {
  // dependsOn: libName -> Set<libName>
  const dependsOn = new Map();
  // dependents: libName -> Set<libName> (reverse map)
  const dependents = new Map();

  for (const libName of libLevels.keys()) {
    dependsOn.set(libName, new Set());
    dependents.set(libName, new Set());
  }

  // Inter-level dependencies: each lib depends on all libs at lower levels
  for (const libName of libLevels.keys()) {
    const myLevel = libLevels.get(libName);
    for (const levelNum of sortedLevelNumbers) {
      if (levelNum >= myLevel) break;
      for (const depLib of levels.get(levelNum)) {
        dependsOn.get(libName).add(depLib);
        dependents.get(depLib).add(libName);
      }
    }
  }

  // Intra-level dependencies for sequential levels
  for (const levelNum of sortedLevelNumbers) {
    if (levelBuildModes.get(levelNum) !== 'sequential') continue;

    const libs = levels.get(levelNum);
    for (let i = 1; i < libs.length; i++) {
      // libs[i] depends on libs[i-1] (sequential chain)
      dependsOn.get(libs[i]).add(libs[i - 1]);
      dependents.get(libs[i - 1]).add(libs[i]);
    }
  }

  // Intra-level dependencies for parallel levels (detected from source imports)
  const intraLevelDeps = scanImportsForParallelLevels(
    levels,
    sortedLevelNumbers,
    levelBuildModes,
    frontendRoot
  );

  for (const [libName, deps] of intraLevelDeps) {
    for (const dep of deps) {
      dependsOn.get(libName).add(dep);
      dependents.get(dep).add(libName);
    }
  }

  return {dependsOn, dependents};
}

/**
 * Returns the full graph info:
 * - libLevels: Map<libName, levelNumber>
 * - levels: Map<levelNumber, libName[]>
 * - sortedLevelNumbers: number[]
 * - levelBuildModes: Map<levelNumber, 'parallel' | 'sequential'>
 * - dependsOn: Map<libName, Set<libName>>
 * - dependents: Map<libName, Set<libName>>
 * - allLibs: string[]
 */
function getLibDependencyGraph(packageJsonPath) {
  if (!packageJsonPath) {
    packageJsonPath = path.resolve(__dirname, '../package.json');
  }

  const frontendRoot = path.dirname(packageJsonPath);
  const {libLevels, levels, sortedLevelNumbers, levelBuildModes} =
    parseBuildOrder(packageJsonPath);
  const {dependsOn, dependents} = buildDependencyMap(
    libLevels,
    levels,
    sortedLevelNumbers,
    levelBuildModes,
    frontendRoot
  );
  const allLibs = [...libLevels.keys()];

  return {
    libLevels,
    levels,
    sortedLevelNumbers,
    levelBuildModes,
    dependsOn,
    dependents,
    allLibs,
  };
}

module.exports = {getLibDependencyGraph};
