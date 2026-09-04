import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  limit,
  Timestamp,
  serverTimestamp
} from 'firebase/firestore';
import firebaseConfig from '@/firebase-applet-config.json';

// Initialize Firebase client instance singleton
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Google Auth Provider with Google Drive file scope
export const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('https://www.googleapis.com/auth/drive.file');

// Sign-in helper returning both User and optional Google Drive Access Token
export async function signInWithGoogle(): Promise<{ user: User; accessToken?: string }> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    const accessToken = credential?.accessToken;

    if (accessToken) {
      sessionStorage.setItem('aura_drive_token', accessToken);
    }

    // Sync or create user root record
    const user = result.user;
    const userRef = doc(db, 'users', user.uid);
    await setDoc(userRef, {
      uid: user.uid,
      email: user.email || '',
      displayName: user.displayName || 'Anonymous User',
      photoURL: user.photoURL || '',
      lastActiveAt: serverTimestamp(),
    }, { merge: true });

    return { user, accessToken };
  } catch (error: any) {
    console.error('[AURA Auth] Sign-in error:', error);
    throw error;
  }
}

export async function logOut(): Promise<void> {
  sessionStorage.removeItem('aura_drive_token');
  await signOut(auth);
}

// Get fresh ID token for backend authentication
export async function getVerifiedToken(): Promise<string | null> {
  const currentUser = auth.currentUser;
  if (!currentUser) return null;
  return await currentUser.getIdToken(true);
}
