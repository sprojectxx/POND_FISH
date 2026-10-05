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

/**
 * Obtain Firebase Cloud Messaging instance
 * @returns {object|null}
 */
function getFirebaseMessaging() {
  getFirebaseAuth(); // ensure firebaseApp is initialized
  if (!firebaseApp) {
    return null;
  }
  return firebaseApp.messaging();
}

/**
 * Send an FCM Push Notification to a device token or topic
 * Provider failure isolation: errors are caught and logged; never throws or crashes business operations.
 * 
 * @param {object} params
 * @param {string} [params.token] - Single device registration token
 * @param {string} [params.topic] - Topic name (e.g. 'all_customers', 'customer_xyz')
 * @param {string} params.title - Notification title
 * @param {string} params.body - Notification body
 * @param {object} [params.data] - Key-value payload strings for deep linking
 * @returns {Promise<{ success: boolean, messageId?: string, error?: string, invalidToken?: boolean, unconfigured?: boolean }>}
 */
async function sendPushNotification({ token, topic, title, body, data = {} }) {
  try {
    const messaging = getFirebaseMessaging();
    if (!messaging) {
      console.warn('[FCM WARNING] Firebase Messaging is unconfigured. Push notification skipped.');
      return {
        success: false,
        unconfigured: true,
        error: 'FIREBASE_NOT_CONFIGURED',
      };
    }

    // Build payload ensuring all data values are strings (FCM requirement)
    const stringifiedData = {};
    for (const [key, val] of Object.entries(data)) {
      stringifiedData[key] = typeof val === 'string' ? val : JSON.stringify(val);
    }

    const message = {
      notification: {
        title,
        body,
      },
      data: stringifiedData,
    };

    if (token) {
      message.token = token;
    } else if (topic) {
      message.topic = topic;
    } else {
      return {
        success: false,
        error: 'NO_TARGET_SPECIFIED',
      };
    }

    const messageId = await messaging.send(message);
    return {
      success: true,
      messageId,
    };
  } catch (error) {
    console.warn('[FCM DELIVERY FAILED]', error.message);
    const isInvalidToken =
      error.code === 'messaging/registration-token-not-registered' ||
      error.code === 'messaging/invalid-registration-token';

    return {
      success: false,
      error: error.message || 'FCM_DELIVERY_FAILED',
      errorCode: error.code,
      invalidToken: isInvalidToken,
    };
  }
}

module.exports = {
  getFirebaseAuth,
  getFirebaseMessaging,
  verifyIdToken,
  sendPushNotification,
};
