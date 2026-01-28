import {ObjectLevel} from '../models';

const collectObjectLevels = (schema: object, returnRequired = false): ObjectLevel[] => {
  const levels: ObjectLevel[] = [];

  function markArray(path: string[]): string[] {
    if (path.length === 0) return ['[]']; // root array
    const newPath = [...path];
    const last = newPath[newPath.length - 1];
    newPath[newPath.length - 1] = `${last}[]`;
    return newPath;
  }

  function visit(node: any, path: string[]) {
    if (!node || typeof node !== 'object') return;

    if (node.type === 'object' && node.properties) {
      const allProps = Object.keys(node.properties);

      let propertiesToStore: string[];

      if (returnRequired) {
        const required: string[] = Array.isArray(node.required) ? node.required : [];
        propertiesToStore = required.filter(propName =>
          Object.prototype.hasOwnProperty.call(node.properties, propName)
        );
      } else {
        propertiesToStore = allProps;
      }

      if (!returnRequired || propertiesToStore.length > 0) {
        levels.push({path, properties: propertiesToStore});
      }

      for (const [propName, propSchema] of Object.entries(node.properties)) {
        visit(propSchema, [...path, propName]);
      }
    }

    if (node.type === 'array' && node.items) {
      const arrayPath = markArray(path);
      const items = node.items;

      if (items.properties || items.type === 'object') {
        visit(items, arrayPath);
      } else {
        for (const [name, child] of Object.entries(items)) {
          visit(child as any, [...arrayPath, name]);
        }
      }
    }

    for (const keyword of ['allOf', 'anyOf', 'oneOf'] as const) {
      if (Array.isArray(node[keyword])) {
        node[keyword].forEach((sub: any) => visit(sub, path));
      }
    }
  }

  visit(schema, []);

  return levels;
};

const getNodeAtPath = (root: any, path: string[]): any => {
  let node: any = root;

  for (const segment of path) {
    if (segment.endsWith('[]')) {
      const base = segment.slice(0, -2); // remove []

      if (!base) {
        if (node.type !== 'array' || !node.items) return null;
        node = node.items;
      } else {
        const arrContainer = node.properties?.[base];
        if (!arrContainer || arrContainer.type !== 'array' || !arrContainer.items) return null;
        node = arrContainer.items;
      }
    } else {
      if (node.properties && node.properties[segment]) {
        node = node.properties[segment];
      } else if (segment in node) {
        node = node[segment];
      } else {
        return null;
      }
    }
  }

  return node;
};

const setRequiredOnSchema = (
  schema: any,
  path: string[],
  property: string,
  isRequired: boolean
): any => {
  const node = getNodeAtPath(schema, path);

  if (!node || typeof node !== 'object') {
    console.warn('setRequiredOnSchema: node not found for path', path);
    return schema;
  }

  if (!node.properties || !Object.prototype.hasOwnProperty.call(node.properties, property)) {
    console.warn('setRequiredOnSchema: property does not exist on node', property, 'at path', path);
    return schema;
  }

  const current = Array.isArray(node.required) ? [...node.required] : [];

  if (isRequired) {
    if (!current.includes(property)) {
      node.required = [...current, property];
    }
  } else {
    const filtered = current.filter(p => p !== property);
    if (filtered.length > 0) {
      node.required = filtered;
    } else {
      delete node.required;
    }
  }

  return schema;
};

export {collectObjectLevels, setRequiredOnSchema};
