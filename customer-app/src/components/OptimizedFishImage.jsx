import React, { useState, useEffect } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';

/**
 * OptimizedFishImage
 * 
 * Reusable product image component with graceful fallback handling:
 * 1. Validates remote URI presence before triggering native image decode.
 * 2. Catches remote network errors and 404s via onError to present fallback placeholder.
 * 3. Never speculatively rewrites image URLs with query params not supported by backend storage.
 * 4. Memoized to avoid image reloads on parent component state updates.
 */
function OptimizedFishImage({
  uri,
  style,
  resizeMode = 'cover',
  fallbackText = '🐟',
  fallbackStyle,
  testID,
}) {
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Reset error state if image URI prop changes
  useEffect(() => {
    setHasError(false);
  }, [uri]);

  const hasValidUri = Boolean(uri && typeof uri === 'string' && uri.trim().length > 0);

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
      onError={() => {
        setHasError(true);
        setIsLoading(false);
      }}
      onLoadStart={() => setIsLoading(true)}
      onLoadEnd={() => setIsLoading(false)}
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
