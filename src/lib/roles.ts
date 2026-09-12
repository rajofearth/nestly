export type RoleId =
  | 'mom'
  | 'dad'
  | 'firstborn'
  | 'kid'
  | 'youngest'
  | 'grandma'
  | 'grandpa'
  | 'custom';

export interface RoleDef {
  id: RoleId;
  label: string;
  hint: string;
  avatar: { shape: string; color: string; expression: string };
}

export const ROLES: RoleDef[] = [
  {
    id: 'mom',
    label: 'Mom',
    hint: 'The heart of the nest',
    avatar: { shape: 'nuage', color: '#e152b0', expression: 'heureux' },
  },
  {
    id: 'dad',
    label: 'Dad',
    hint: 'Chief navigator',
    avatar: { shape: 'squircle', color: '#3b93f0', expression: 'neutre' },
  },
  {
    id: 'firstborn',
    label: 'First born',
    hint: 'The eldest, leading the way',
    avatar: { shape: 'goutte', color: '#f0a93b', expression: 'fier' },
  },
  {
    id: 'kid',
    label: 'Kid',
    hint: 'Always on an adventure',
    avatar: { shape: 'galet', color: '#2fa37c', expression: 'curieux' },
  },
  {
    id: 'youngest',
    label: 'Youngest',
    hint: 'The little one of the nest',
    avatar: { shape: 'cercle', color: '#9b7ede', expression: 'somnolent' },
  },
  {
    id: 'grandma',
    label: 'Grandma',
    hint: 'Warmth and wisdom',
    avatar: { shape: 'nuage', color: '#f26b4e', expression: 'heureux' },
  },
  {
    id: 'grandpa',
    label: 'Grandpa',
    hint: 'Stories and steady steps',
    avatar: { shape: 'hexagone', color: '#6e6355', expression: 'neutre' },
  },
  {
    id: 'custom',
    label: 'Someone else',
    hint: 'Auntie, uncle, cousin, friend...',
    avatar: { shape: 'triangle', color: '#3e8ede', expression: 'curieux' },
  },
];

export function roleLabel(role?: string, roleLabelOverride?: string | null): string {
  if (roleLabelOverride && roleLabelOverride.trim()) return roleLabelOverride.trim();
  if (!role) return 'Family';
  return ROLES.find((r) => r.id === role)?.label ?? role;
}

export function roleAvatar(role?: string): { shape: string; color: string; expression: string } {
  return ROLES.find((r) => r.id === role)?.avatar ?? {
    shape: 'cercle',
    color: '#3b93f0',
    expression: 'neutre',
  };
}
