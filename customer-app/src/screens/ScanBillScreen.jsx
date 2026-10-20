/**
 * Screen: CP-13 / CP-06 — Scan Physical Bill Screen
 * Traceability: PondFish Customer Mobile App UI Specification (Sections 75, 76, 77, 78)
 * 
 * Provides:
 * 1. Camera viewfinder / capture interface with scanning reticle
 * 2. Real-time sample receipt selector for emulator/device verification
 * 3. File upload / image picker support
 * 4. Image quality validation and AI reading loading states
 * 5. Seamless navigation to Bill Review Screen upon OCR completion
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  StatusBar,
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  PermissionsAndroid,
} from 'react-native';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import { colors } from '../theme/colors';
import { api } from '../services/api';


export default function ScanBillScreen({ onNavigate }) {
  const [processing, setProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState('');
  const [errorMessage, setErrorMessage] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);

  async function requestCameraPermission() {
    if (Platform.OS !== 'android') return true;
    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.CAMERA,
        {
          title: 'PondFish Camera Access',
          message: 'PondFish needs camera access to capture printed store counter receipts for OCR reading.',
          buttonPositive: 'Allow',
          buttonNegative: 'Deny',
        }
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    } catch (err) {
      console.warn('[CAMERA PERMISSION ERROR]', err);
      return false;
    }
  }

  async function handleLaunchCamera() {
    setErrorMessage(null);
    const hasPermission = await requestCameraPermission();
    if (!hasPermission) {
      Alert.alert(
        'Camera Permission Denied',
        'Camera permission is required to capture counter bills. You can also select an existing receipt image from your gallery.',
        [
          { text: 'Choose from Gallery', onPress: handleLaunchGallery },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
      return;
    }

    try {
      const result = await launchCamera({
        mediaType: 'photo',
        cameraType: 'back',
        quality: 0.85,
        maxWidth: 1600,
        maxHeight: 2000,
        includeBase64: true,
        saveToPhotos: false,
      });

      if (result.didCancel) {
        return; // User cancelled gracefully
      }

      if (result.errorCode) {
        if (result.errorCode === 'permission') {
          Alert.alert('Permission Error', 'Camera permission was not granted by Android.');
        } else {
          Alert.alert('Camera Error', result.errorMessage || 'Unable to open camera.');
        }
        return;
      }

      const asset = result.assets?.[0];
      if (!asset || (!asset.uri && !asset.base64)) {
        Alert.alert('Capture Error', 'No image data captured. Please try again.');
        return;
      }

      setSelectedImage(asset);
    } catch (err) {
      console.warn('[CAMERA LAUNCH ERROR]', err);
      setErrorMessage('Unable to launch camera. Please try selecting an image from gallery.');
    }
  }

  async function handleLaunchGallery() {
    setErrorMessage(null);
    try {
      const result = await launchImageLibrary({
        mediaType: 'photo',
        quality: 0.85,
        maxWidth: 1600,
        maxHeight: 2000,
        includeBase64: true,
      });

      if (result.didCancel) {
        return; // User cancelled gracefully
      }

      if (result.errorCode) {
        Alert.alert('Gallery Error', result.errorMessage || 'Unable to open gallery.');
        return;
      }

      const asset = result.assets?.[0];
      if (!asset || (!asset.uri && !asset.base64)) {
        Alert.alert('Image Error', 'No image selected.');
        return;
      }

      setSelectedImage(asset);
    } catch (err) {
      console.warn('[GALLERY LAUNCH ERROR]', err);
      setErrorMessage('Unable to open photo gallery.');
    }
  }

  async function handleUploadAndExtract() {
    if (!selectedImage) {
      Alert.alert('Image Required', 'Please capture or select a bill image first.');
      return;
    }

    try {
      setErrorMessage(null);
      setProcessing(true);
      setProcessingStep('Uploading receipt image...');

      let res;
      const isDryRun = Boolean(__DEV__);
      if (selectedImage.base64) {
        setProcessingStep('AI reading receipt with OCR...');
        const base64Data = `data:${selectedImage.type || 'image/jpeg'};base64,${selectedImage.base64}`;
        res = await api.scanBill({
          imageBase64: base64Data,
          imageUrl: `/uploads/bills/${selectedImage.fileName || 'captured-bill.jpg'}`,
          dryRun: isDryRun,
        });
      } else {
        setProcessingStep('Uploading receipt image...');
        const formData = new FormData();
        formData.append('bill_image', {
          uri: selectedImage.uri,
          name: selectedImage.fileName || 'bill.jpg',
          type: selectedImage.type || 'image/jpeg',
        });
        res = await api.scanBill({ formData, dryRun: isDryRun });
      }

      if (!res.success || !res.data) {
        throw new Error(res.error?.message || "We couldn't identify a bill in this image. Please scan the bill again.");
      }

      if (res.data.status === 'UNREADABLE' || (res.data.confidence_score !== undefined && res.data.confidence_score < 0.15 && (!res.data.items || res.data.items.length === 0))) {
        throw new Error("We couldn't read this bill clearly. Please take another photo.");
      }

      setProcessingStep('Preparing review...');
      onNavigate('BILL_REVIEW', {
        scanId: res.data.scan_id || res.data.bill_id,
        initialScan: res.data,
        capturedImageUri: selectedImage.uri,
      });
    } catch (err) {
      console.warn('[OCR SCAN ERROR]', err);
      const msg = err.message || "We couldn't read this bill clearly. Please take another photo.";
      setErrorMessage(msg);
      Alert.alert('Scan Unsuccessful', msg, [{ text: 'OK' }]);
    } finally {
      setProcessing(false);
      setProcessingStep('');
    }
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.bgMain} />

      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => onNavigate('HOME')}
          activeOpacity={0.7}
        >
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Scan Counter Bill</Text>
          <Text style={styles.headerSub}>Capture physical store receipt for OCR verification</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Camera / Preview Viewfinder Box */}
        <View style={styles.viewfinderCard}>
          <View style={styles.reticleFrame}>
            {selectedImage ? (
              <Image
                source={{ uri: selectedImage.uri }}
                style={styles.previewImage}
                resizeMode="contain"
              />
            ) : (
              <>
                <View style={[styles.corner, styles.cornerTL]} />
                <View style={[styles.corner, styles.cornerTR]} />
                <View style={[styles.corner, styles.cornerBL]} />
                <View style={[styles.corner, styles.cornerBR]} />

                {processing ? (
                  <View style={styles.processingOverlay}>
                    <ActivityIndicator size="large" color={colors.accent} />
                    <Text style={styles.processingText}>{processingStep}</Text>
                    <Text style={styles.processingSub}>AI is analyzing receipt items & totals</Text>
                  </View>
                ) : (
                  <View style={styles.viewfinderInner}>
                    <Text style={{ fontSize: 44, marginBottom: 12 }}>🧾</Text>
                    <Text style={styles.viewfinderPrompt}>Align printed bill inside this frame</Text>
                    <Text style={styles.viewfinderSub}>Ensure Bill ID and fish cuts are clearly visible</Text>
                  </View>
                )}
              </>
            )}

            {selectedImage && (
              <View style={styles.previewBadge}>
                <Text style={styles.previewBadgeText}>📷 Image Ready for OCR</Text>
              </View>
            )}
          </View>

          {/* Action Trigger Buttons */}
          {selectedImage ? (
            <View style={styles.previewActionsRow}>
              <TouchableOpacity
                style={[styles.confirmButton, processing && styles.buttonDisabled]}
                onPress={handleUploadAndExtract}
                disabled={processing}
                activeOpacity={0.8}
              >
                {processing ? (
                  <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 8 }} />
                ) : (
                  <Text style={styles.actionIcon}>⚡</Text>
                )}
                <Text style={styles.confirmButtonText}>
                  {processing ? processingStep : 'Scan & Extract Bill with AI →'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.retakeButton, processing && styles.buttonDisabled]}
                onPress={() => setSelectedImage(null)}
                disabled={processing}
                activeOpacity={0.7}
              >
                <Text style={styles.retakeButtonText}>← Retake / Choose Another</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.captureButtonsRow}>
              <TouchableOpacity
                style={[styles.captureButton, processing && styles.captureButtonDisabled]}
                onPress={handleLaunchCamera}
                disabled={processing}
                activeOpacity={0.8}
              >
                <Text style={styles.captureButtonIcon}>📷</Text>
                <Text style={styles.captureButtonText}>Open Camera</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.galleryButton, processing && styles.buttonDisabled]}
                onPress={handleLaunchGallery}
                disabled={processing}
                activeOpacity={0.8}
              >
                <Text style={styles.galleryButtonIcon}>🖼️</Text>
                <Text style={styles.galleryButtonText}>Choose from Gallery</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Error Alert Banner */}
        {errorMessage && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorIcon}>⚠️</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.errorTitle}>Scan Unsuccessful</Text>
              <Text style={styles.errorDesc}>{errorMessage}</Text>
            </View>
          </View>
        )}

        {/* Genuine Physical Bill Verification Notice */}
        <View style={styles.guidelinesCard}>
          <Text style={styles.guidelinesTitle}>💡 How Counter Bill Scanning Works</Text>
          <Text style={styles.guidelineBullet}>• Capture or upload the physical paper bill received at the PondFish store counter</Text>
          <Text style={styles.guidelineBullet}>• PondFish AI will extract the Bill ID, purchased fish cuts, weights, and total</Text>
          <Text style={styles.guidelineBullet}>• Your active subscription quota and credit are automatically calculated</Text>
          <Text style={styles.guidelineBullet}>• You can review all details and correct the Bill ID before final checkout</Text>
        </View>

        {/* Quality Guidelines Card */}
        <View style={[styles.guidelinesCard, { marginTop: 12 }]}>
          <Text style={styles.guidelinesTitle}>📸 Image Quality Tips</Text>
          <Text style={styles.guidelineBullet}>• Place receipt flat on a dark or contrasted surface</Text>
          <Text style={styles.guidelineBullet}>• Ensure all text, especially the Bill ID and total, is clear and well-lit</Text>
          <Text style={styles.guidelineBullet}>• Avoid heavy glare, shadows, or cropped edges</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgMain,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    backgroundColor: colors.bgCard,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.bgMain,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  backButtonText: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: '700',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  headerSub: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  viewfinderCard: {
    backgroundColor: colors.bgCard,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 20,
  },
  reticleFrame: {
    height: 240,
    backgroundColor: '#0F172A',
    borderRadius: 12,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  corner: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderColor: colors.accent,
  },
  cornerTL: {
    top: 14,
    left: 14,
    borderTopWidth: 3,
    borderLeftWidth: 3,
  },
  cornerTR: {
    top: 14,
    right: 14,
    borderTopWidth: 3,
    borderRightWidth: 3,
  },
  cornerBL: {
    bottom: 14,
    left: 14,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
  },
  cornerBR: {
    bottom: 14,
    right: 14,
    borderBottomWidth: 3,
    borderRightWidth: 3,
  },
  viewfinderInner: {
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  viewfinderPrompt: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
  viewfinderSub: {
    color: '#94A3B8',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 6,
  },
  processingOverlay: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  processingText: {
    color: colors.accent,
    fontSize: 16,
    fontWeight: '800',
    marginTop: 12,
  },
  processingSub: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 4,
  },
  captureButtonsRow: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 10,
  },
  captureButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
    borderRadius: 12,
    height: 48,
  },
  captureButtonDisabled: {
    opacity: 0.6,
  },
  captureButtonIcon: {
    fontSize: 18,
    marginRight: 6,
  },
  captureButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  galleryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    height: 48,
  },
  galleryButtonIcon: {
    fontSize: 18,
    marginRight: 6,
  },
  galleryButtonText: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  previewImage: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
  previewBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0, 122, 120, 0.9)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  previewBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  previewActionsRow: {
    marginTop: 16,
  },
  confirmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
    borderRadius: 12,
    height: 48,
    marginBottom: 10,
  },
  confirmButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  retakeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgMain,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    height: 44,
  },
  retakeButtonText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  actionIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: '#EF4444',
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
  },
  errorIcon: {
    fontSize: 24,
    marginRight: 10,
  },
  errorTitle: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: '700',
  },
  errorDesc: {
    color: '#F87171',
    fontSize: 12,
    marginTop: 2,
  },
  sectionHeader: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  sectionSub: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  sampleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 10,
  },
  sampleIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: 'rgba(2, 132, 199, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  sampleTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  sampleDesc: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  sampleArrow: {
    fontSize: 18,
    color: colors.textMuted,
    marginLeft: 8,
  },
  guidelinesCard: {
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 10,
  },
  guidelinesTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.accent,
    marginBottom: 6,
  },
  guidelineBullet: {
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 18,
  },
});
