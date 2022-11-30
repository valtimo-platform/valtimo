type CaseSearchFieldDataType = 'text' | 'number' | 'date' | 'datetime' | 'boolean';

type CaseSearchFieldFieldType = 'single' | 'multiple' | 'range';

type CaseSearchFieldMatchType = 'exact' | 'like';

interface CaseSearchField {
  key: string;
  datatype: CaseSearchFieldDataType;
  fieldtype: CaseSearchFieldFieldType;
  matchtype: CaseSearchFieldMatchType;
}

export {
  CaseSearchFieldDataType,
  CaseSearchFieldFieldType,
  CaseSearchFieldMatchType,
  CaseSearchField,
};
