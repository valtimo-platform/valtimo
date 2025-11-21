import {BasicWidget} from '@valtimo/layout';

export interface CaseWidgetsRes {
  caseDefinitionKey: string;
  caseDefinitionVersionTag: string;
  key: string;
  widgets: BasicWidget[];
}
