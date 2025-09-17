// constants/ProfessionalTheme.ts
export const ProfessionalTheme = {
  colors: {
    // Primary Colors - Professional Blue Palette
    primary: '#1E88E5',        // Professional blue
    secondary: '#5E35B1',      // Deep purple
    accent: '#FFB300',         // Gold accent
    
    // Surface Colors
    background: '#0A0F1C',     // Very dark blue-black
    surface: '#141B2D',        // Dark surface
    elevated: '#1C2541',       // Elevated surface
    
    // Text Colors
    text: '#FFFFFF',           // Pure white
    textSecondary: '#94A3B8',  // Muted gray-blue
    textTertiary: '#64748B',   // Darker muted
    
    // State Colors
    success: '#4ADE80',        // Professional green
    error: '#EF4444',          // Professional red
    warning: '#F59E0B',        // Amber
    info: '#3B82F6',           // Information blue
    
    // Special Colors
    verified: '#22C55E',       // Verified green
    premium: '#9333EA',        // Premium purple
    
    // Gradient definitions - ADD MISSING ONES
    gradient: {
      primary: ['#1E88E5', '#1565C0'],
      secondary: ['#5E35B1', '#4527A0'],
      premium: ['#1E88E5', '#5E35B1', '#9333EA'],
      accent: ['#FFB300', '#FFA000'],
      success: ['#4ADE80', '#22C55E'],
      // ADD THESE MISSING GRADIENTS:
      background: ['#0A0F1C', '#141B2D'],  // Add this
      verified: ['#22C55E', '#4ADE80'],    // Add this
      error: ['#EF4444', '#DC2626'],       // Add this
      warning: ['#F59E0B', '#D97706'],     // Add this
      info: ['#3B82F6', '#2563EB'],        // Add this
    },
  },
  
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },
  
  borderRadius: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    full: 999,
  },
  
  typography: {
    // Font sizes
    fontSize: {
      xs: 12,
      sm: 14,
      base: 16,
      lg: 18,
      xl: 20,
      '2xl': 24,
      '3xl': 30,
      '4xl': 36,
    },
    // Font weights
    fontWeight: {
      normal: '400',
      medium: '500',
      semibold: '600',
      bold: '700',
      extrabold: '800',
      black: '900',
    },
  },
  
  shadows: {
    sm: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 2,
    },
    md: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 4,
    },
    lg: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
      elevation: 8,
    },
  },
};
