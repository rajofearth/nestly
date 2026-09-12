export const colors = {
  cream: '#FFF8EE',
  creamDeep: '#FBF0E1',
  surface: '#FFFFFF',
  border: '#F0E6D8',
  borderStrong: '#E3D5C2',
  ink: '#231D15',
  inkSoft: '#6E6355',
  inkFaint: '#A79A89',
  coral: '#FF6B4A',
  coralSoft: '#FFE8E0',
  sky: '#3E8EDE',
  skySoft: '#E3F0FC',
  mint: '#2FA37C',
  mintSoft: '#E2F5EC',
  amber: '#F0A93B',
  amberSoft: '#FCF0DC',
  lilac: '#9B7EDE',
  lilacSoft: '#F0EAFC',
  rose: '#E152B0',
  danger: '#E5484D',
  dangerSoft: '#FDEBEB',
  white: '#FFFFFF',
};

export type Palette = typeof colors;

export const spacing = {
  xs: 4,
  s: 8,
  m: 12,
  l: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
};

export const radius = {
  s: 12,
  m: 16,
  l: 24,
  xl: 32,
  pill: 999,
};

export const shadow = {
  card: {
    shadowColor: '#231D15',
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  float: {
    shadowColor: '#231D15',
    shadowOpacity: 0.12,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
} as const;

export const typography = {
  display: { fontFamily: 'Nunito_800ExtraBold', fontSize: 32, lineHeight: 38, color: colors.ink },
  title: { fontFamily: 'Nunito_800ExtraBold', fontSize: 24, lineHeight: 30, color: colors.ink },
  heading: { fontFamily: 'Nunito_700Bold', fontSize: 18, lineHeight: 24, color: colors.ink },
  body: { fontFamily: 'Nunito_600SemiBold', fontSize: 15, lineHeight: 22, color: colors.ink },
  bodySoft: { fontFamily: 'Nunito_600SemiBold', fontSize: 15, lineHeight: 22, color: colors.inkSoft },
  small: { fontFamily: 'Nunito_600SemiBold', fontSize: 13, lineHeight: 18, color: colors.inkSoft },
  tiny: { fontFamily: 'Nunito_700Bold', fontSize: 11, lineHeight: 14, color: colors.inkFaint, letterSpacing: 0.6 },
  button: { fontFamily: 'Nunito_800ExtraBold', fontSize: 16 },
} as const;
