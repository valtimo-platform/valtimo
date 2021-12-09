export type Direction = 'ASC' | 'DESC';

export interface Sort {
  name: string;
  direction: Direction;
}

export interface SortState {
  state: Sort;
  isSorting: boolean;
}
