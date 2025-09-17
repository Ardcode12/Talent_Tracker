import React from 'react';
import { LinearGradient as ExpoLinearGradient } from 'expo-linear-gradient';

export const LinearGradient = (props) => {
  const { colors, ...rest } = props;
  
  // Check if colors is valid
  let safeColors = colors;
  
  if (!colors || !Array.isArray(colors) || colors.length < 2) {
    console.warn('LinearGradient: Invalid colors prop:', colors);
    safeColors = ['#1E88E5', '#1565C0']; // Default to primary gradient
  } else if (colors.some(color => !color)) {
    console.warn('LinearGradient: Undefined color in array:', colors);
    safeColors = colors.filter(Boolean);
    if (safeColors.length < 2) {
      safeColors = ['#1E88E5', '#1565C0']; // Default to primary gradient
    }
  }
  
  return <ExpoLinearGradient {...rest} colors={safeColors} />;
};

export default LinearGradient;
