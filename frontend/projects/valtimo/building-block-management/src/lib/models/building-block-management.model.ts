import {BUILDING_BLOCK_MANAGEMENT_TABS} from '../constants';

type BuildingBlockManagementTabKey =
  (typeof BUILDING_BLOCK_MANAGEMENT_TABS)[keyof typeof BUILDING_BLOCK_MANAGEMENT_TABS];

export {BuildingBlockManagementTabKey};
