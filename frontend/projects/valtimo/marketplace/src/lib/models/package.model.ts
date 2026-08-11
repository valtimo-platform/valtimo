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

/** Artifact kind, as published in the store's `packages.json`. */
enum PackageType {
  PLUGIN = 'plugin',
  CASE = 'case',
  BUILDING_BLOCK = 'building-block',
}

/** Which lifecycle operations the backend accepts for this package. */
interface PackageCapabilities {
  installable: boolean;
  updatable: boolean;
  uninstallable: boolean;
}

/** How much a package's origin is trusted. Derived by the backend, not by the store. */
enum PackageTrust {
  VERIFIED = 'VERIFIED',
  COMMUNITY = 'COMMUNITY',
  UNKNOWN = 'UNKNOWN',
}

enum PackageOperation {
  INSTALL = 'INSTALL',
  UPDATE = 'UPDATE',
  UNINSTALL = 'UNINSTALL',
  UPLOAD = 'UPLOAD',
}

enum PackageJobStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  SUCCEEDED = 'SUCCEEDED',
  FAILED = 'FAILED',
}

enum PackageJobStage {
  DOWNLOADING = 'DOWNLOADING',
  DEPLOYING = 'DEPLOYING',
  IMPORTING = 'IMPORTING',
  REMOVING = 'REMOVING',
  COMPLETED = 'COMPLETED',
}

/** One install/update/uninstall/upload attempt: live progress and the audit record. */
interface PackageJob {
  id: string;
  packageId: string;
  packageName?: string;
  packageType?: string;
  operation: PackageOperation;
  fromVersion?: string;
  toVersion?: string;
  status: PackageJobStatus;
  stage?: PackageJobStage;
  createdBy?: string;
  createdOn: string;
  finishedOn?: string;
  errorMessage?: string;
}

/** What the backend says would happen, shown as a review step before committing. */
interface PackagePreflight {
  packageId: string;
  packageName?: string;
  type?: string;
  trust: PackageTrust;
  targetVersion: string;
  installedVersion?: string;
  operation: PackageOperation;
  requires?: string;
  compatible: boolean;
  reversible: boolean;
  hotLoadable: boolean;
  downloadSizeBytes?: number;
  /** Non-empty means the operation must not be offered. */
  blockers: string[];
  warnings: string[];
}

/** A configured package repository. */
interface PackageStore {
  id: string;
  url?: string;
  packageCount: number;
  reachable: boolean;
}

interface PackageRelease {
  version: string;
  date?: string;
  requires?: string;
  compatible: boolean;
}

interface PackageListItem {
  id: string;
  name?: string;
  logo?: string;
  description?: string;
  type?: string;
  provider?: string;
  projectUrl?: string;
  issuesUrl?: string;
  owner?: string;
  trust: PackageTrust;
  repositoryId?: string;
  installedVersion?: string;
  nextVersion?: string;
  latestVersion?: string;
  compatible: boolean;
  incompatibleReason?: string;
  releases: PackageRelease[];
  capabilities: PackageCapabilities;
}

/**
 * A package prepared for a table row. `carbon-list` renders raw values, so anything the
 * cards express with a tag or a fallback has to be pre-rendered into a string here.
 */
interface PackageRow extends PackageListItem {
  typeLabel: string;
  availableVersion?: string;
}

interface PackageCatalogue {
  packages: PackageListItem[];
  lastRefreshed?: string;
  updatesAvailable: number;
  systemVersion: string;
}

/** Which tab of the marketplace is showing. */
enum MarketplaceTab {
  DISCOVER = 'discover',
  INSTALLED = 'installed',
  UPDATES = 'updates',
  ACTIVITY = 'activity',
  STORES = 'stores',
}

enum PackageSort {
  NAME_ASC = 'nameAsc',
  NAME_DESC = 'nameDesc',
  UPDATED_DESC = 'updatedDesc',
}

enum PackageViewType {
  GRID = 'grid',
  TABLE = 'table',
}

/** Discover-tab filter state. */
interface PackageFilters {
  search: string;
  types: string[];
  sort: PackageSort;
}

/** Which step of the install flow the modal is showing. */
enum InstallFlowStep {
  REVIEW = 'review',
  PROGRESS = 'progress',
  RESULT = 'result',
}

/** An activity row prepared for `carbon-list`, which renders raw values only. */
interface PackageJobRow extends PackageJob {
  packageLabel: string;
  operationLabel: string;
  statusLabel: string;
  versionChange: string;
}

export {
  InstallFlowStep,
  MarketplaceTab,
  PackageCapabilities,
  PackageCatalogue,
  PackageFilters,
  PackageJob,
  PackageJobRow,
  PackageJobStage,
  PackageJobStatus,
  PackageListItem,
  PackageOperation,
  PackagePreflight,
  PackageRelease,
  PackageRow,
  PackageSort,
  PackageStore,
  PackageTrust,
  PackageType,
  PackageViewType,
};
