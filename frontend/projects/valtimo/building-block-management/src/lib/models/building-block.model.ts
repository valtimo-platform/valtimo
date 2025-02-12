export interface BuildingBlock {
  id: string;
  name: string;
  description?: string;
  linkedCasesIds: string[];
}

export enum BUILDING_BLOCK_TAB {
  PROCESSES = 'processes',
  FORMS = 'forms',
  FORM_FLOWS = 'formFlows',
  DECISIONS = 'decisions',
  CASES = 'cases',
}
