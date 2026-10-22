import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { env } from './env';

let firestoreInstance: FirebaseFirestore.Firestore | null = null;
let isMock = false;

export function initFirebase(): { db: FirebaseFirestore.Firestore | null; isMock: boolean } {
  if (firestoreInstance || isMock) {
    return { db: firestoreInstance, isMock };
  }

  // Check emulator
  if (process.env.FIRESTORE_EMULATOR_HOST || env.FIRESTORE_EMULATOR_HOST) {
    if (!admin.apps.length) {
      admin.initializeApp({ projectId: env.FIREBASE_PROJECT_ID });
    }
    firestoreInstance = admin.firestore();
    console.log('Firebase initialized with Firestore Emulator host:', process.env.FIRESTORE_EMULATOR_HOST || env.FIRESTORE_EMULATOR_HOST);
    return { db: firestoreInstance, isMock: false };
  }

  // Check service account JSON string
  if (env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    try {
      const creds = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON);
      if (!admin.apps.length) {
        admin.initializeApp({
          credential: admin.credential.cert(creds),
          projectId: env.FIREBASE_PROJECT_ID,
        });
      }
      firestoreInstance = admin.firestore();
      console.log('Firebase initialized with inline service account credentials.');
      return { db: firestoreInstance, isMock: false };
    } catch (err) {
      console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON:', err);
    }
  }

  // Check service account file path
  const certPath = env.FIREBASE_SERVICE_ACCOUNT_KEY || env.GOOGLE_APPLICATION_CREDENTIALS;
  if (certPath) {
    const resolvedPath = path.isAbsolute(certPath)
      ? certPath
      : path.resolve(process.cwd(), certPath);

    if (fs.existsSync(resolvedPath)) {
      try {
        if (!admin.apps.length) {
          admin.initializeApp({
            credential: admin.credential.cert(resolvedPath),
            projectId: env.FIREBASE_PROJECT_ID,
          });
        }
        firestoreInstance = admin.firestore();
        console.log('Firebase initialized with service account key file:', resolvedPath);
        return { db: firestoreInstance, isMock: false };
      } catch (err) {
        console.error('Failed to initialize Firebase with credential file:', err);
      }
    }
  }

  // Check if standard GOOGLE_APPLICATION_CREDENTIALS is in env
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS && fs.existsSync(process.env.GOOGLE_APPLICATION_CREDENTIALS)) {
    try {
      if (!admin.apps.length) {
        admin.initializeApp({
          credential: admin.credential.applicationDefault(),
          projectId: env.FIREBASE_PROJECT_ID,
        });
      }
      firestoreInstance = admin.firestore();
      console.log('Firebase initialized with application default credentials.');
      return { db: firestoreInstance, isMock: false };
    } catch (err) {
      console.error('Failed to initialize Firebase with application default credentials:', err);
    }
  }

  // If mock fallback enabled
  if (env.USE_FIRESTORE_MOCK_FALLBACK) {
    console.warn(
      '⚠️  No Firebase credentials or emulator found. Falling back to In-Memory Firestore Store for development/testing.'
    );
    isMock = true;
    return { db: null, isMock: true };
  }

  throw new Error(
    'Firebase credentials not configured and USE_FIRESTORE_MOCK_FALLBACK is set to false. Please provide serviceAccountKey.json or set FIRESTORE_EMULATOR_HOST.'
  );
}

export function getFirestore(): FirebaseFirestore.Firestore | null {
  const { db } = initFirebase();
  return db;
}

export function isFirestoreMock(): boolean {
  const { isMock } = initFirebase();
  return isMock;
}

export { admin };
