/**
 * Firebase Admin SDK Boundary Foundation
 * Traceability: PondFish Integration Specification v1 (Section 5)
 * Verifies Customer Phone Auth OTP tokens.
 * Credentials are read strictly from environment boundaries. No credentials invented.
 */

let firebaseApp = null;

function getFirebaseAuth() {
  const admin = require('firebase-admin');

  if (!firebaseApp) {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY
      ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
      : null;

    if (projectId && clientEmail && privateKey) {
      firebaseApp = admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey,
        }),
      });
    } else {
      console.warn('[FIREBASE WARNING] Firebase Admin SDK credentials not fully configured in environment. Auth verification will require valid env variables.');
      return null;
    }
  }

  return firebaseApp.auth();
}

/**
 * Verify a Firebase ID token issued after client Phone OTP completion
 * @param {string} idToken
 * @returns {Promise<{ uid: string, phone_number: string }>}
 */
async function verifyIdToken(idToken) {
  const auth = getFirebaseAuth();
  if (!auth) {
    throw new Error('Firebase Auth is not configured. Please supply FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY in .env');
  }
  return auth.verifyIdToken(idToken);
}

module.exports = {
  getFirebaseAuth,
  verifyIdToken,
};
