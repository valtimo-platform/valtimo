import {BuildingBlock} from '../models/building-block.model';

export const BUILDING_BLOCKS: BuildingBlock[] = [
  {
    id: 'block1',
    name: 'Block 1',
    description: 'Block 1',
    linkedCasesIds: ['bezwaar', 'evenementenvergunningen']
  },
  {
    id: 'block2',
    name: 'Block 2',
    description: 'Block 2',
    linkedCasesIds: []
  },
  {
    id: 'block3',
    name: 'Block 3',
    description: 'Block 3',
    linkedCasesIds: []
  },
];
