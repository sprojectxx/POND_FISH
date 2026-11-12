/**
 * Screen: CP-13 / CP-06 — Scan Physical Bill Screen
 * Traceability: PondFish Customer Mobile App UI Specification & pondfish.in Coastal Standards
 * 
 * Provides:
 * 1. Clean website-standard receipt scanner interface
 * 2. Precision corner reticle with dashed receipt alignment canvas
 * 3. Modern Open Camera & Choose from Gallery action buttons (zero clip-art emojis)
 * 4. Collapsible "See how bill scanning works" guide
 * 5. Full OCR pipeline with Bill Review navigation
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
  Modal,
} from 'react-native';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import { api } from '../services/api';

export default function ScanBillScreen({ onNavigate }) {
  const [processing, setProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState('');
  const [errorMessage, setErrorMessage] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [showHowItWorks, setShowHowItWorks] = useState(false);

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

      if (result.didCancel) return;

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

      if (result.didCancel) return;

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
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

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

      {/* Centered Main Viewport */}
      <View style={styles.centerWrapper}>
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
                    <ActivityIndicator size="large" color="#1E56A0" />
                    <Text style={styles.processingText}>{processingStep}</Text>
                    <Text style={styles.processingSub}>AI is analyzing receipt items & totals</Text>
                  </View>
                ) : (
                  <View style={styles.viewfinderInner}>
                    <View style={styles.receiptGraphicBox}>
                      <View style={styles.receiptHeaderBar} />
                      <View style={styles.receiptBodyLine1} />
                      <View style={styles.receiptBodyLine2} />
                      <View style={styles.receiptBodyLine3} />
                    </View>
                    <Text style={styles.viewfinderPrompt}>Align printed receipt inside this frame</Text>
                    <Text style={styles.viewfinderSub}>Ensure Bill ID, item weights, and total are clear</Text>
                  </View>
                )}
              </>
            )}

            {selectedImage && (
              <View style={styles.previewBadge}>
                <Text style={styles.previewBadgeText}>Image Ready for OCR Analysis</Text>
              </View>
            )}
          </View>

          {/* Action Buttons: Camera & Gallery */}
          {selectedImage ? (
            <View style={styles.previewActionsRow}>
              <TouchableOpacity
                style={[styles.confirmButton, processing && styles.buttonDisabled]}
                onPress={handleUploadAndExtract}
                disabled={processing}
                activeOpacity={0.85}
              >
                {processing ? (
                  <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 8 }} />
                ) : null}
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
                style={[styles.captureButton, processing && styles.buttonDisabled]}
                onPress={handleLaunchCamera}
                disabled={processing}
                activeOpacity={0.85}
              >
                <Text style={styles.captureButtonText}>Open Camera</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.galleryButton, processing && styles.buttonDisabled]}
                onPress={handleLaunchGallery}
                disabled={processing}
                activeOpacity={0.85}
              >
                <Text style={styles.galleryButtonText}>Choose from Gallery</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Error Alert Banner */}
        {errorMessage && (
          <View style={styles.errorBanner}>
            <View style={{ flex: 1 }}>
              <Text style={styles.errorTitle}>Scan Unsuccessful</Text>
              <Text style={styles.errorDesc}>{errorMessage}</Text>
            </View>
          </View>
        )}

        {/* Need Help Button (Opens clean bottom sheet modal, never pushes content up) */}
        <TouchableOpacity
          style={styles.howItWorksToggle}
          onPress={() => setShowHowItWorks(true)}
          activeOpacity={0.8}
        >
          <Text style={styles.howItWorksToggleText}>
            ▼  Need help? See how bill scanning works
          </Text>
        </TouchableOpacity>
      </View>

      {/* Clean Slide-Up Help Bottom Sheet Modal */}
      <Modal
        visible={showHowItWorks}
        transparent
        animationType="slide"
        onRequestClose={() => setShowHowItWorks(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowHowItWorks(false)}
        >
          <TouchableOpacity
            style={styles.guideBottomSheet}
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>How Counter Bill Scanning Works</Text>

            <View style={styles.stepItemRow}>
              <View style={styles.stepNumBadge}><Text style={styles.stepNumText}>1</Text></View>
              <Text style={styles.stepDesc}>Capture or select your paper receipt received at the PondFish store counter</Text>
            </View>

            <View style={styles.stepItemRow}>
              <View style={styles.stepNumBadge}><Text style={styles.stepNumText}>2</Text></View>
              <Text style={styles.stepDesc}>PondFish AI automatically extracts the Bill ID, purchased fish cuts, weights, and total</Text>
            </View>

            <View style={styles.stepItemRow}>
              <View style={styles.stepNumBadge}><Text style={styles.stepNumText}>3</Text></View>
              <Text style={styles.stepDesc}>Your subscription credit and quota balance are calculated and applied</Text>
            </View>

            <View style={styles.stepItemRow}>
              <View style={styles.stepNumBadge}><Text style={styles.stepNumText}>4</Text></View>
              <Text style={styles.stepDesc}>You can review all details and edit any value before final checkout</Text>
            </View>

            <View style={styles.tipsBox}>
              <Text style={styles.tipsTitle}>Receipt Image Tips</Text>
              <Text style={styles.tipLine}>• Place receipt flat on a clean surface</Text>
              <Text style={styles.tipLine}>• Ensure good lighting and that all 4 corners are inside frame</Text>
              <Text style={styles.tipLine}>• Avoid heavy glare, shadows, or cropped edges</Text>
            </View>

            <TouchableOpacity
              style={styles.closeSheetBtn}
              onPress={() => setShowHowItWorks(false)}
              activeOpacity={0.88}
            >
              <Text style={styles.closeSheetBtnText}>Got It</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 12 : 8,
    paddingBottom: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  backButtonText: {
    color: '#0F2C59',
    fontSize: 18,
    fontWeight: '700',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F2C59',
    letterSpacing: -0.3,
  },
  headerSub: {
    fontSize: 12,
    color: '#425B73',
    marginTop: 2,
    fontWeight: '500',
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 16,
    paddingBottom: 40,
  },
  
  centerWrapper: {
    flex: 1,
    justifyContent: 'center',
    padding: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end',
  },
  guideBottomSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    backgroundColor: '#CBD5E1',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F2C59',
    marginBottom: 16,
  },
  stepItemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    gap: 10,
  },
  stepNumBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#1E56A0',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  stepNumText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  stepDesc: {
    flex: 1,
    fontSize: 13,
    color: '#334155',
    lineHeight: 18,
  },
  tipsBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 6,
    marginBottom: 18,
  },
  tipsTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F2C59',
    marginBottom: 6,
  },
  tipLine: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 3,
  },
  closeSheetBtn: {
    backgroundColor: '#1E56A0',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeSheetBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  viewfinderCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
    shadowColor: '#0F2C59',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  reticleFrame: {
    height: 240,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderStyle: 'dashed',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  corner: {
    position: 'absolute',
    width: 22,
    height: 22,
    borderColor: '#1E56A0',
  },
  cornerTL: {
    top: 10,
    left: 10,
    borderTopWidth: 3,
    borderLeftWidth: 3,
  },
  cornerTR: {
    top: 10,
    right: 10,
    borderTopWidth: 3,
    borderRightWidth: 3,
  },
  cornerBL: {
    bottom: 10,
    left: 10,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
  },
  cornerBR: {
    bottom: 10,
    right: 10,
    borderBottomWidth: 3,
    borderRightWidth: 3,
  },
  viewfinderInner: {
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  receiptGraphicBox: {
    width: 48,
    height: 60,
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#94A3B8',
    padding: 6,
    justifyContent: 'space-around',
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  receiptHeaderBar: {
    height: 4,
    backgroundColor: '#1E56A0',
    borderRadius: 2,
  },
  receiptBodyLine1: {
    height: 3,
    backgroundColor: '#CBD5E1',
    borderRadius: 1.5,
    width: '75%',
  },
  receiptBodyLine2: {
    height: 3,
    backgroundColor: '#CBD5E1',
    borderRadius: 1.5,
    width: '90%',
  },
  receiptBodyLine3: {
    height: 3,
    backgroundColor: '#159C57',
    borderRadius: 1.5,
    width: '50%',
  },
  viewfinderPrompt: {
    color: '#0F2C59',
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  viewfinderSub: {
    color: '#64748B',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
    fontWeight: '500',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  previewBadge: {
    position: 'absolute',
    bottom: 10,
    backgroundColor: '#0F2C59',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  previewBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  processingOverlay: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  processingText: {
    color: '#1E56A0',
    fontSize: 16,
    fontWeight: '800',
    marginTop: 12,
  },
  processingSub: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 4,
    fontWeight: '500',
  },
  captureButtonsRow: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 10,
  },
  captureButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E56A0',
    borderRadius: 10,
    height: 46,
    shadowColor: '#1E56A0',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  captureButtonText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '800',
  },
  galleryButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#1E56A0',
    borderRadius: 10,
    height: 46,
  },
  galleryButtonText: {
    color: '#1E56A0',
    fontSize: 13.5,
    fontWeight: '800',
  },
  previewActionsRow: {
    marginTop: 16,
  },
  confirmButton: {
    backgroundColor: '#1E56A0',
    borderRadius: 10,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  confirmButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  retakeButton: {
    marginTop: 10,
    alignItems: 'center',
    paddingVertical: 8,
  },
  retakeButtonText: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  errorBanner: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#DC2626',
  },
  errorDesc: {
    fontSize: 12,
    color: '#7F1D1D',
    marginTop: 2,
  },
  howItWorksToggle: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    marginBottom: 12,
  },
  howItWorksToggleText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E56A0',
  },
  guidelinesCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
  },
  guidelinesSectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F2C59',
    marginBottom: 8,
    letterSpacing: -0.2,
  },
  guidelineBullet: {
    fontSize: 12,
    lineHeight: 18,
    color: '#425B73',
    marginBottom: 6,
    fontWeight: '500',
  },
  guidelinesDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 12,
  },
});
