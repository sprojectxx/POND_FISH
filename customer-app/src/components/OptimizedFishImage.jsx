import React, { useState, useEffect } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { isValidImageUri } from '../utils/image-validator';

export { isValidImageUri };

/**
 * OptimizedFishImage
 * 
 * Reusable product image component providing safe remote image loading and error fallbacks:
 * 1. Validates remote URI presence before triggering native image decode.
 * 2. Catches remote network errors and 404s via onError to present a local fallback placeholder.
 * 3. Does not modify or rewrite image URLs (no speculative CDN query parameters).
 * 4. Enables client-side image downsampling via resizeMethod="resize" on Android.
 * 5. Memoized to avoid unnecessary image reloading on parent component re-renders.
 */
function OptimizedFishImage({
  uri,
  style,
  resizeMode = 'cover',
  resizeMethod = 'resize',
  fallbackText = '🐟',
  fallbackStyle,
  testID,
}) {
  const [hasError, setHasError] = useState(false);

  // Reset error state if image URI prop changes
  useEffect(() => {
    setHasError(false);
  }, [uri]);

  const hasValidUri = isValidImageUri(uri);

  if (!hasValidUri || hasError) {
    return (
      <View
        style={[styles.fallbackContainer, style, fallbackStyle]}
        testID={testID ? `${testID}-fallback` : 'optimized-image-fallback'}
      >
        <Text style={styles.fallbackEmoji}>{fallbackText}</Text>
      </View>
    );
  }

  return (
    <Image
      source={{ uri }}
      style={style}
      resizeMode={resizeMode}
      resizeMethod={resizeMethod}
      onError={() => setHasError(true)}
      testID={testID || 'optimized-image'}
    />
  );
}

const styles = StyleSheet.create({
  fallbackContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
  },
  fallbackEmoji: {
    fontSize: 24,
  },
});

export default React.memo(OptimizedFishImage);

