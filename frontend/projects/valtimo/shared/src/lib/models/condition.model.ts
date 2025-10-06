enum Operator {
  NOT_EQUAL_TO = '!=',
  EQUAL_TO = '==',
  GREATER_THAN = '>',
  GREATER_THAN_OR_EQUAL_TO = '>=',
  LESS_THAN = '<',
  LESS_THAN_OR_EQUAL_TO = '<=',
}

interface Condition {
  path: string;
  operator: string;
  value: string;
}

export {Operator, Condition};
