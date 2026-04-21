// utils/dataGenerator.ts

type EntityType = 'case' | 'form' | 'dashboard' | 'formFlow' | 'caseDefinition';

/**
 * Generates a short, unique ID based on timestamp and random characters.
 * Example: 'lmno23-f4x9'
 */
export function generateId(): string {
  return Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 6);
}

/**
 * Generates a standardized, readable name for any entity.
 * Example: 'case-lmno23-f4x9'
 */
export function generateName(entity: EntityType, prefix = ''): string {
  const base = prefix || entity;
  return `${base}-${generateId()}`;
}
