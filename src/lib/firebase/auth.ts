import { 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  updatePassword,
  onAuthStateChanged,
  User as FirebaseUser,
  UserCredential,
  sendEmailVerification,
  updateProfile,
  signInWithPopup,
  GoogleAuthProvider,
  OAuthProvider,
} from 'firebase/auth';
import { auth, isDemoMode } from './config';
import { doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from './config';

// Types compatible with Supabase auth interface
export interface User {
  id: string;
  email: string | null;
  created_at?: string;
  app_metadata?: Record<string, any>;
  user_metadata?: {
    full_name?: string;
    role?: 'admin' | 'employee' | 'customer';
    employee_category?: string;
  };
  aud?: string;
  confirmation_sent_at?: string | null;
  recovery_sent_at?: string | null;
  email_confirmed_at?: string | null;
  invited_at?: string | null;
  action_link?: string | null;
  last_sign_in_at?: string | null;
  phone?: string | null;
  confirmed_at?: string | null;
  email_change_sent_at?: string | null;
  new_email?: string | null;
  new_phone?: string | null;
  phone_confirmed_at?: string | null;
  phone_change?: string | null;
  phone_change_token?: string | null;
  email_change?: string | null;
  email_change_token?: string | null;
  is_anonymous?: boolean;
}

export interface Session {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  expires_at: number;
  token_type: string;
  user: User;
}

export interface SignUpData {
  email: string;
  password: string;
  fullName?: string;
  role?: 'admin' | 'employee' | 'customer';
  employeeCategory?: string;
}

export interface SignInData {
  email: string;
  password: string;
}

// Convert Firebase User to our User type
const convertFirebaseUser = async (firebaseUser: FirebaseUser): Promise<User> => {
  // Get user profile from Firestore
  let userData = null;
  try {
    if (!isDemoMode) {
      const userDocRef = doc(db, 'users', firebaseUser.uid);
      const userDoc = await getDoc(userDocRef);
      
      if (userDoc.exists()) {
        userData = userDoc.data();
      }
    }
  } catch (error: any) {
    // If offline, try to get from cache explicitly
    if (error?.code === 'unavailable' || error?.message?.includes('offline')) {
      try {
        const { getDocFromCache } = await import('firebase/firestore');
        const userDocRef = doc(db, 'users', firebaseUser.uid);
        const cachedDoc = await getDocFromCache(userDocRef);
        if (cachedDoc.exists()) {
          userData = cachedDoc.data();
          console.log('Using cached user data (offline mode)');
        }
      } catch (cacheError) {
        // No cache available, will use defaults
        console.warn('No cached user data available, using defaults');
      }
    } else {
      // Other errors, log and continue with defaults
      console.warn('Failed to fetch user data from Firestore:', error);
    }
  }

  return {
    id: firebaseUser.uid,
    email: firebaseUser.email,
    created_at: firebaseUser.metadata.creationTime,
    email_confirmed_at: firebaseUser.emailVerified ? firebaseUser.metadata.creationTime : null,
    confirmed_at: firebaseUser.emailVerified ? firebaseUser.metadata.creationTime : null,
    last_sign_in_at: firebaseUser.metadata.lastSignInTime || null,
    user_metadata: {
      full_name: userData?.full_name || firebaseUser.displayName || undefined,
      role: userData?.role || 'admin',
      employee_category: userData?.employee_category || undefined,
    },
    app_metadata: {},
    aud: 'authenticated',
    is_anonymous: false,
  };
};

// Create session from user
const createSession = async (user: User): Promise<Session> => {
  // Get ID token for access token
  let token = 'demo-token';
  try {
    if (!isDemoMode) {
      const firebaseUser = auth.currentUser;
      if (firebaseUser) {
        token = await firebaseUser.getIdToken();
      }
    }
  } catch (error) {
    // If token retrieval fails, use a fallback token
    console.warn('Failed to get ID token:', error);
    token = 'fallback-token';
  }

  return {
    access_token: token,
    refresh_token: 'firebase-refresh-token', // Firebase handles refresh automatically
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    token_type: 'bearer',
    user,
  };
};

// Demo mode mock user
const createMockUser = (email: string, role: 'admin' | 'employee' | 'customer' = 'admin'): User => ({
  id: `demo-${Date.now()}`,
  email,
  created_at: new Date().toISOString(),
  app_metadata: {},
  user_metadata: {
    full_name: email.split('@')[0],
    role,
  },
  aud: 'authenticated',
  email_confirmed_at: new Date().toISOString(),
  confirmed_at: new Date().toISOString(),
  last_sign_in_at: new Date().toISOString(),
  is_anonymous: false,
});

const createMockSession = (user: User): Session => ({
  access_token: 'demo-token',
  refresh_token: 'demo-refresh-token',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  token_type: 'bearer',
  user,
});

export const authService = {
  async signUp(data: SignUpData) {
    if (isDemoMode) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      const mockUser = createMockUser(data.email, data.role || 'admin');
      const mockSession = createMockSession(mockUser);
      return {
        user: mockUser,
        session: mockSession,
      };
    }

    try {
      // Create auth user
      const userCredential: UserCredential = await createUserWithEmailAndPassword(
        auth,
        data.email,
        data.password
      );

      // Update profile with display name
      if (data.fullName) {
        await updateProfile(userCredential.user, {
          displayName: data.fullName,
        });
      }

      // Send email verification
      await sendEmailVerification(userCredential.user);

      // Create user document in Firestore
      const userDoc = {
        id: userCredential.user.uid,
        email: data.email,
        full_name: data.fullName || null,
        role: data.role || 'admin',
        employee_category: data.employeeCategory || null,
        agency_id: null, // Will be set when organization is created
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      await setDoc(doc(db, 'users', userCredential.user.uid), userDoc);

      // Convert to our User type
      const user = await convertFirebaseUser(userCredential.user);
      const session = await createSession(user);

      return {
        user,
        session,
      };
    } catch (error: any) {
      if (error.message?.includes('Failed to fetch') || error.message?.includes('NetworkError')) {
        throw new Error('Unable to connect to authentication server. Please check your internet connection or Firebase configuration.');
      }
      throw error;
    }
  },

  async signIn(data: SignInData) {
    if (isDemoMode) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      const mockUser = createMockUser(data.email, 'admin');
      const mockSession = createMockSession(mockUser);
      return {
        user: mockUser,
        session: mockSession,
      };
    }

    try {
      const userCredential: UserCredential = await signInWithEmailAndPassword(
        auth,
        data.email,
        data.password
      );

      // Update or create user document in Firestore (don't block on this)
      const userDocRef = doc(db, 'users', userCredential.user.uid);
      const userDocData = {
        id: userCredential.user.uid,
        email: data.email,
        full_name: userCredential.user.displayName || null,
        role: 'admin',
        is_active: true,
        last_login: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      
      // Try to update first, if that fails, create the document
      Promise.resolve()
        .then(async () => {
          try {
            await updateDoc(userDocRef, {
              last_login: userDocData.last_login,
              updated_at: userDocData.updated_at,
            });
          } catch (updateError: any) {
            // Document doesn't exist, create it
            if (updateError.code === 'not-found' || updateError.message?.includes('No document')) {
              await setDoc(userDocRef, {
                ...userDocData,
                created_at: new Date().toISOString(),
              }, { merge: true });
            } else {
              // Other error, try to create anyway
              await setDoc(userDocRef, {
                ...userDocData,
                created_at: new Date().toISOString(),
              }, { merge: true });
            }
          }
        })
        .catch((error) => {
          // Don't block login if Firestore update fails
          console.warn('Failed to update user document in Firestore:', error);
        });

      const user = await convertFirebaseUser(userCredential.user);
      const session = await createSession(user);

      return {
        user,
        session,
      };
    } catch (error: any) {
      if (error.message?.includes('Failed to fetch') || error.message?.includes('NetworkError')) {
        throw new Error('Unable to connect to authentication server. Please check your internet connection or Firebase configuration.');
      }
      throw error;
    }
  },

  async signOut() {
    if (isDemoMode) {
      return;
    }

    try {
      await signOut(auth);
    } catch (error: any) {
      if (error.message?.includes('Failed to fetch') || error.message?.includes('NetworkError')) {
        throw new Error('Unable to connect to authentication server.');
      }
      throw error;
    }
  },

  async resetPassword(email: string) {
    if (isDemoMode) {
      throw new Error('Password reset is not available in demo mode. Please configure Firebase to use this feature.');
    }

    try {
      await sendPasswordResetEmail(auth, email, {
        url: `${window.location.origin}/auth/reset-password`,
      });
    } catch (error: any) {
      if (error.message?.includes('Failed to fetch') || error.message?.includes('NetworkError')) {
        throw new Error('Unable to connect to authentication server.');
      }
      throw error;
    }
  },

  async updatePassword(newPassword: string) {
    if (isDemoMode) {
      throw new Error('Password update is not available in demo mode.');
    }

    try {
      const user = auth.currentUser;
      if (!user) {
        // Try to get user from the URL hash (password reset flow)
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const mode = hashParams.get('mode');
        const oobCode = hashParams.get('oobCode');
        
        if (mode === 'resetPassword' && oobCode) {
          // Firebase password reset - user needs to sign in with the code first
          // This is handled by Firebase automatically when they click the reset link
          throw new Error('Please use the password reset link from your email to set a new password.');
        }
        throw new Error('No user logged in. Please sign in first.');
      }
      await updatePassword(user, newPassword);
    } catch (error: any) {
      if (error.message?.includes('Failed to fetch') || error.message?.includes('NetworkError')) {
        throw new Error('Unable to connect to authentication server.');
      }
      throw error;
    }
  },

  async getSession(): Promise<Session | null> {
    if (isDemoMode) {
      const demoSession = localStorage.getItem('demo_session');
      if (demoSession) {
        try {
          return JSON.parse(demoSession);
        } catch {
          return null;
        }
      }
      return null;
    }

    try {
      const user = auth.currentUser;
      if (!user) return null;

      const userData = await convertFirebaseUser(user);
      return await createSession(userData);
    } catch (error: any) {
      if (error.message?.includes('Failed to fetch') || error.message?.includes('NetworkError')) {
        return null;
      }
      throw error;
    }
  },

  async getUser(): Promise<User | null> {
    if (isDemoMode) {
      const session = await this.getSession();
      return session?.user || null;
    }

    try {
      const user = auth.currentUser;
      if (!user) return null;
      return await convertFirebaseUser(user);
    } catch (error: any) {
      if (error.message?.includes('Failed to fetch') || error.message?.includes('NetworkError')) {
        return null;
      }
      throw error;
    }
  },

  async signInWithGoogle() {
    if (isDemoMode) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      const mockUser = createMockUser('demo@google.com', 'admin');
      const mockSession = createMockSession(mockUser);
      return {
        user: mockUser,
        session: mockSession,
      };
    }

    try {
      const provider = new GoogleAuthProvider();
      // Request additional scopes if needed
      provider.addScope('profile');
      provider.addScope('email');
      
      const userCredential: UserCredential = await signInWithPopup(auth, provider);
      
      // Create or update user document in Firestore
      const userDocRef = doc(db, 'users', userCredential.user.uid);
      const userDocData = {
        id: userCredential.user.uid,
        email: userCredential.user.email,
        full_name: userCredential.user.displayName || userCredential.user.email?.split('@')[0] || 'User',
        role: 'admin', // Default role, can be updated later
        is_active: true,
        last_login: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        provider: 'google',
      };

      // Check if user document exists
      const userDoc = await getDoc(userDocRef);
      if (userDoc.exists()) {
        // Update existing user
        await updateDoc(userDocRef, {
          last_login: userDocData.last_login,
          updated_at: userDocData.updated_at,
          email: userCredential.user.email,
          full_name: userCredential.user.displayName || userDoc.data()?.full_name,
        });
      } else {
        // Create new user document
        await setDoc(userDocRef, {
          ...userDocData,
          created_at: new Date().toISOString(),
        });
      }

      const user = await convertFirebaseUser(userCredential.user);
      const session = await createSession(user);

      return {
        user,
        session,
      };
    } catch (error: any) {
      if (error.code === 'auth/popup-closed-by-user') {
        throw new Error('Sign-in was cancelled. Please try again.');
      }
      if (error.code === 'auth/popup-blocked') {
        throw new Error('Popup was blocked by your browser. Please allow popups and try again.');
      }
      if (error.message?.includes('Failed to fetch') || error.message?.includes('NetworkError')) {
        throw new Error('Unable to connect to authentication server. Please check your internet connection.');
      }
      throw error;
    }
  },

  async signInWithApple() {
    if (isDemoMode) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      const mockUser = createMockUser('demo@apple.com', 'admin');
      const mockSession = createMockSession(mockUser);
      return {
        user: mockUser,
        session: mockSession,
      };
    }

    try {
      const provider = new OAuthProvider('apple.com');
      // Request additional scopes
      provider.addScope('email');
      provider.addScope('name');
      
      const userCredential: UserCredential = await signInWithPopup(auth, provider);
      
      // Extract name from additionalUserInfo if available
      let displayName = userCredential.user.displayName;
      if (!displayName && (userCredential as any).additionalUserInfo?.profile) {
        const profile = (userCredential as any).additionalUserInfo.profile;
        if (profile.name) {
          displayName = `${profile.name.givenName || ''} ${profile.name.familyName || ''}`.trim();
        }
      }
      
      // Create or update user document in Firestore
      const userDocRef = doc(db, 'users', userCredential.user.uid);
      const userDocData = {
        id: userCredential.user.uid,
        email: userCredential.user.email,
        full_name: displayName || userCredential.user.email?.split('@')[0] || 'User',
        role: 'admin', // Default role, can be updated later
        is_active: true,
        last_login: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        provider: 'apple',
      };

      // Check if user document exists
      const userDoc = await getDoc(userDocRef);
      if (userDoc.exists()) {
        // Update existing user
        await updateDoc(userDocRef, {
          last_login: userDocData.last_login,
          updated_at: userDocData.updated_at,
          email: userCredential.user.email,
          full_name: displayName || userDoc.data()?.full_name,
        });
      } else {
        // Create new user document
        await setDoc(userDocRef, {
          ...userDocData,
          created_at: new Date().toISOString(),
        });
      }

      const user = await convertFirebaseUser(userCredential.user);
      const session = await createSession(user);

      return {
        user,
        session,
      };
    } catch (error: any) {
      if (error.code === 'auth/popup-closed-by-user') {
        throw new Error('Sign-in was cancelled. Please try again.');
      }
      if (error.code === 'auth/popup-blocked') {
        throw new Error('Popup was blocked by your browser. Please allow popups and try again.');
      }
      if (error.code === 'auth/unauthorized-domain') {
        throw new Error('Apple sign-in is not configured for this domain. Please contact support.');
      }
      if (error.message?.includes('Failed to fetch') || error.message?.includes('NetworkError')) {
        throw new Error('Unable to connect to authentication server. Please check your internet connection.');
      }
      throw error;
    }
  },

  onAuthStateChange(callback: (event: string, session: Session | null) => void) {
    if (isDemoMode) {
      const checkDemoSession = () => {
        const demoSession = localStorage.getItem('demo_session');
        if (demoSession) {
          try {
            const session = JSON.parse(demoSession);
            callback('SIGNED_IN', session);
          } catch {
            callback('SIGNED_OUT', null);
          }
        } else {
          callback('SIGNED_OUT', null);
        }
      };

      checkDemoSession();

      const handleStorageChange = (e: StorageEvent) => {
        if (e.key === 'demo_session') {
          checkDemoSession();
        }
      };
      window.addEventListener('storage', handleStorageChange);

      return {
        data: {
          subscription: {
            unsubscribe: () => {
              window.removeEventListener('storage', handleStorageChange);
            },
          },
        },
      };
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const user = await convertFirebaseUser(firebaseUser);
        const session = await createSession(user);
        callback('SIGNED_IN', session);
      } else {
        callback('SIGNED_OUT', null);
      }
    });

    return {
      data: {
        subscription: {
          unsubscribe,
        },
      },
    };
  },
};

