import {CaseChangeLog} from '../models';
import {COLLABORATORS} from './case-collaborators.mock';

export const CASE_CHANGE_LOGS: CaseChangeLog[] = [
  {
    user: COLLABORATORS[0],
    timestamp: '2024/10/03 23:19:16',
    message: 'Initialize case definition',
  },
  {
    user: COLLABORATORS[1],
    timestamp: '2024/10/24 03:46:12',
    message: 'Reordered list fields',
  },
  {
    user: COLLABORATORS[0],
    timestamp: '2024/11/10 01:27:13',
    message: 'Altered document definition schema',
  },
  {
    user: COLLABORATORS[2],
    timestamp: '2024/10/18 20:20:30',
    message: 'Changed DocumentenAPI search fields',
  },
  {
    user: COLLABORATORS[3],
    timestamp: '2024/10/11 16:33:02',
    message: 'Edit search fields',
  },
  {
    user: COLLABORATORS[3],
    timestamp: '2024/10/14 22:48:23',
    message: 'Remove field from document schema',
  },
  {
    user: COLLABORATORS[4],
    timestamp: '2024/10/18 08:16:14',
    message: 'Remove obsolete list column',
  },
  {
    user: COLLABORATORS[0],
    timestamp: '2024/10/26 23:25:31',
    message: 'Add new search field',
  },
];
