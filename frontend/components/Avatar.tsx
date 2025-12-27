// frontend/components/Avatar.tsx
import React, { useState, useCallback } from 'react';
import { 
  Image, 
  View, 
  Text, 
  StyleSheet, 
  ViewStyle,
  ImageStyle 
} from 'react-native';

interface AvatarProps {
  uri?: string | null;
  name?: string;
  size?: number;
  style?: ViewStyle | ImageStyle;
  textStyle?: any;
}

// Generate initials from name
const getInitials = (name: string): string => {
  if (!name || name.trim() === '') return 'U';
  
  const cleanName = name.trim();
  const parts = cleanName.split(/\s+/);
  
  if (parts.length === 1) {
    return parts[0].charAt(0).toUpperCase();
  }
  
  return (
    parts[0].charAt(0) + 
    parts[parts.length - 1].charAt(0)
  ).toUpperCase();
};

// Generate consistent color from name
const getColorFromName = (name: string): string => {
  const colors = [
    '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', 
    '#f97316', '#eab308', '#22c55e', '#14b8a6',
    '#06b6d4', '#3b82f6', '#a855f7', '#d946ef'
  ];
  
  let hash = 0;
  const str = name || 'User';
  for (let i = 0; i < str.length; i++) {
    hash += str.charCodeAt(i);
  }
  
  return colors[hash % colors.length];
};

// Generate avatar URL
const generateAvatarUrl = (name: string, size: number): string => {
  const safeName = encodeURIComponent(name || 'User');
  const color = getColorFromName(name).replace('#', '');
  return `https://ui-avatars.com/api/?background=${color}&color=fff&name=${safeName}&size=${size * 2}&bold=true`;
};

export const Avatar: React.FC<AvatarProps> = ({ 
  uri, 
  name = 'User', 
  size = 50,
  style,
  textStyle
}) => {
  const [imageError, setImageError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  const initials = getInitials(name);
  const backgroundColor = getColorFromName(name);
  
  // Check if URI is valid
  const isValidUri = useCallback(() => {
    if (!uri) return false;
    if (uri === 'null' || uri === 'undefined') return false;
    if (uri.trim() === '') return false;
    return true;
  }, [uri]);
  
  const showImage = isValidUri() && !imageError;
  
  const containerStyle: ViewStyle = {
    width: size,
    height: size,
    borderRadius: size / 2,
    backgroundColor: backgroundColor,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  };
  
  const handleError = useCallback(() => {
    console.log('Avatar image load error:', uri);
    setImageError(true);
    setIsLoading(false);
  }, [uri]);
  
  const handleLoad = useCallback(() => {
    setIsLoading(false);
  }, []);

  // If we have a valid image URL, try to load it
  if (showImage) {
    return (
      <View style={[containerStyle, style]}>
        {/* Fallback initials shown while loading or on error */}
        <View style={[styles.initialsContainer, { backgroundColor }]}>
          <Text style={[styles.initials, { fontSize: size * 0.4 }, textStyle]}>
            {initials}
          </Text>
        </View>
        
        {/* Actual image */}
        <Image
          source={{ uri: uri! }}
          style={[styles.image, { width: size, height: size, borderRadius: size / 2 }]}
          onError={handleError}
          onLoad={handleLoad}
          resizeMode="cover"
        />
      </View>
    );
  }
  
  // Show initials avatar
  return (
    <View style={[containerStyle, style]}>
      <Text style={[styles.initials, { fontSize: size * 0.4 }, textStyle]}>
        {initials}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  initialsContainer: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  initials: {
    color: '#ffffff',
    fontWeight: 'bold',
    textAlign: 'center',
  },
  image: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
});

export default Avatar;