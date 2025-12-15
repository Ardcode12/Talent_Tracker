// constants/Theme.ts
import { ProfessionalTheme } from './ProfessionalTheme';

export const Theme = {
  ...ProfessionalTheme,
  colors: {
    ...ProfessionalTheme.colors,
    gradient: {
      ...ProfessionalTheme.colors.gradient,
      coach: ['#667eea', '#764ba2'], // Purple gradient for coaches
    },
  },
};

// Export individual theme aspects for backward compatibility
export const Colors = Theme.colors;
export const Spacing = Theme.spacing;
export const BorderRadius = Theme.borderRadius;
export const Typography = Theme.typography;
export const Shadows = Theme.shadows;

