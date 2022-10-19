type SearchFieldDataType = 'text' | 'number' | 'date' | 'datetime' | 'boolean';

type SearchFieldFieldType = 'single' | 'multiple' | 'range';

type SearchFieldMatchType = 'exact' | 'like';

type BooleanValueSingle = boolean;

type TextValueSingle = string;
type TextValueMultiple = Array<TextValueSingle>;

type NumberValueSingle = number;
interface NumberValueRange {
  start: NumberValueSingle;
  end: NumberValueSingle;
}

type SearchFieldValue = BooleanValueSingle | TextValueSingle | NumberValueSingle | NumberValueRange;

interface SearchField {
  key: string;
  datatype: SearchFieldDataType;
  fieldtype: SearchFieldFieldType;
  matchtype: SearchFieldMatchType;
}

interface SearchFieldWithValue extends SearchField {
  value: SearchFieldValue;
}

export {
  SearchFieldDataType,
  SearchFieldFieldType,
  SearchFieldMatchType,
  SearchField,
  SearchFieldValue,
  SearchFieldWithValue,
};
