/**
 * Firebase Phone Authentication Client Service
 * Traceability: PondFish Integration Specification (Section 6)
 * Encapsulates real Firebase Phone OTP dispatch and confirmation for React Native.
 * Uses @react-native-firebase/auth exclusively. Zero mock pathways.
 */

import auth from '@react-native-firebase/auth';

let confirmationResult = null;

/**
 * Initiates real Firebase Phone OTP verification for an Indian mobile number
 * @param {string} mobileNumber - 10 digit Indian mobile number
 * @returns {Promise<{ verificationId?: string }>}
 */
export async function sendFirebasePhoneOtp(mobileNumber) {
  const formattedNumber = `+91${mobileNumber.replace(/\D/g, '').slice(-10)}`;

  try {
    confirmationResult = await auth().signInWithPhoneNumber(formattedNumber);
    return { verificationId: confirmationResult.verificationId };
  } catch (error) {
    console.error('[FIREBASE PHONE AUTH DISPATCH ERROR]', error.code, error.message);
    throw new Error(error.message || 'Failed to dispatch phone verification OTP via Firebase.');
  }
}

/**
 * Confirms OTP code with Firebase and returns real Firebase ID token
 * @param {string} otpCode - 6 digit verification code
 * @returns {Promise<{ idToken: string, user: object }>}
 */
export async function verifyFirebasePhoneOtp(otpCode) {
  if (!confirmationResult || typeof confirmationResult.confirm !== 'function') {
    throw new Error('No active verification session found. Please request a new OTP.');
  }

  try {
    const userCredential = await confirmationResult.confirm(otpCode);
    if (!userCredential || !userCredential.user) {
      throw new Error('Firebase authentication failed. No user record returned.');
    }

    const idToken = await userCredential.user.getIdToken();
    if (!idToken) {
      throw new Error('Failed to retrieve Firebase ID token from authenticated user.');
    }

    return {
      idToken,
      user: userCredential.user,
    };
  } catch (error) {
    console.error('[FIREBASE OTP CONFIRMATION ERROR]', error.code, error.message);
    throw new Error(error.message || 'The verification code is incorrect or expired. Please try again.');
  }
}
