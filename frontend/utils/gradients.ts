// utils/gradients.ts
import { Theme } from '../constants/Theme';

export const AppGradients = {
  // Header gradient
  header: {
    colors: [...Theme.colors.gradient.dark],
    start: { x: 0, y: 0 },
    end: { x: 0, y: 1 },
  },
  
  // Card gradient
  card: {
    colors: ['rgba(28, 37, 65, 0.6)', 'rgba(20, 27, 45, 0.4)'],
    start: { x: 0, y: 0 },
    end: { x: 1, y: 1 },
  },
  
  // Premium feature gradient
  premium: {
    colors: Theme.colors.gradient.premium,
    start: { x: 0, y: 0 },
    end: { x: 1, y: 1 },
  },
  
  // Achievement gradient
  achievement: {
    colors: Theme.colors.gradient.achievement,
    start: { x: 0, y: 0 },
    end: { x: 1, y: 0 },
  },
  
  // Success gradient
  success: {
    colors: ['#10B981', '#059669', '#047857'],
    start: { x: 0, y: 0 },
    end: { x: 1, y: 1 },
  },
};
