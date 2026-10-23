export * from './enums';
export * from './entities';

import type { Contact, TeamMember } from './entities';

export function fullName(person: Pick<Contact | TeamMember, 'firstName' | 'lastName'>): string {
  return `${person.firstName} ${person.lastName}`.trim();
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0][0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? '') : '';
  return (first + last).toUpperCase();
}
