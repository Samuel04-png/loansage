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
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  OAuthProvider,
  browserPopupRedirectResolver,
} from 'firebase/auth';
import { auth, isDemoMode } from './config';
import { doc, setDoc, getDoc, updateDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { db } from './config';

// Mobile detection helper - checks for mobile browsers where popups don't work well
export const isMobileDevice = (): boolean => {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false;
  }
  
  const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera || '';
  
  // Check for mobile user agents
  const mobileRegex = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile|tablet/i;
  const isMobileUA = mobileRegex.test(userAgent.toLowerCase());
  
  // Check for touch device with small screen (likely mobile)
  const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const isSmallScreen = window.innerWidth <= 768;
  
  // Also check for standalone mode (PWA)
  const isStandalone = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
    (window.navigator as any).standalone === true;
  
  return isMobileUA || (isTouchDevice && isSmallScreen) || isStandalone;
};

// Check if we're in an in-app browser (WebView) where popups definitely won't work
const isInAppBrowser = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return /FBAN|FBAV|Instagram|Twitter|Line|WhatsApp|Snapchat|WeChat|MicroMessenger/i.test(ua);
};

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
  referralCode?: string;
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

      // Handle referral tracking
      let referredByUserId: string | null = null;
      if (data.referralCode) {
        try {
          // Extract user ID from referral code (format: TENGALOANS-XXXXXXXX)
          const codeParts = data.referralCode.split('-');
          if (codeParts.length === 2 && codeParts[0] === 'TENGALOANS') {
            // Search for user with matching ID prefix
            const usersRef = collection(db, 'users');
            const usersSnapshot = await getDocs(usersRef);
            const matchingUser = usersSnapshot.docs.find(doc => 
              doc.id.startsWith(codeParts[1].toLowerCase())
            );
            if (matchingUser) {
              referredByUserId = matchingUser.id;
              
              // Update referrer's stats
              const referrerRef = doc(db, 'users', referredByUserId);
              const referrerSnap = await getDoc(referrerRef);
              if (referrerSnap.exists()) {
                const referrerData = referrerSnap.data();
                const referralCount = (referrerData.referralCount || 0) + 1;
                await updateDoc(referrerRef, {
                  referralCount,
                  updated_at: new Date().toISOString(),
                });
              }
            }
          }
        } catch (error) {
          console.warn('Failed to process referral:', error);
        }
      }

      // Create user document in Firestore
      const userDoc = {
        id: userCredential.user.uid,
        email: data.email,
        full_name: data.fullName || null,
        role: data.role || 'admin',
        employee_category: data.employeeCategory || null,
        agency_id: null, // Will be set when organization is created
        is_active: true,
        welcomeEmailSent: false, // Will be set to true by welcome email function
        referred_by: referredByUserId,
        referral_code: data.referralCode || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      await setDoc(doc(db, 'users', userCredential.user.uid), userDoc);
      
      // Create referral record if referred
      if (referredByUserId) {
        const referralRef = doc(db, 'referrals', `${referredByUserId}_${userCredential.user.uid}`);
        await setDoc(referralRef, {
          referrerId: referredByUserId,
          referredUserId: userCredential.user.uid,
          referredEmail: data.email,
          status: 'pending', // pending, active, rewarded
          createdAt: new Date().toISOString(),
        });
      }

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
      // Set custom parameters for better mobile experience
      provider.setCustomParameters({
        prompt: 'select_account',
      });
      
      // Use redirect on mobile devices for better UX (popups often fail on mobile)
      const useMobile = isMobileDevice() || isInAppBrowser();
      
      if (useMobile) {
        // Store that we're doing a redirect login
        sessionStorage.setItem('oauth_pending_provider', 'google');
        await signInWithRedirect(auth, provider);
        // This function won't return - user will be redirected
        // The result will be handled by handleRedirectResult when the page reloads
        return { user: null, session: null };
      }
      
      // Use popup on desktop
      const userCredential: UserCredential = await signInWithPopup(auth, provider, browserPopupRedirectResolver);
      
      // Process the user credential
      return await this.processOAuthCredential(userCredential, 'google');
    } catch (error: any) {
      // On popup failure, fallback to redirect
      if (error.code === 'auth/popup-blocked' || error.code === 'auth/popup-closed-by-user') {
        try {
          const provider = new GoogleAuthProvider();
          provider.addScope('profile');
          provider.addScope('email');
          provider.setCustomParameters({ prompt: 'select_account' });
          sessionStorage.setItem('oauth_pending_provider', 'google');
          await signInWithRedirect(auth, provider);
          return { user: null, session: null };
        } catch (redirectError) {
          console.error('Redirect fallback failed:', redirectError);
        }
      }
      
      if (error.code === 'auth/popup-closed-by-user') {
        throw new Error('Sign-in was cancelled. Please try again.');
      }
      if (error.code === 'auth/popup-blocked') {
        throw new Error('Popup was blocked. Redirecting to Google sign-in...');
      }
      if (error.code === 'auth/cancelled-popup-request') {
        throw new Error('Another sign-in is in progress. Please wait.');
      }
      if (error.code === 'auth/operation-not-allowed') {
        throw new Error('Google sign-in is not enabled. Please contact support.');
      }
      if (error.code === 'auth/unauthorized-domain') {
        throw new Error('This domain is not authorized for Google sign-in. Please contact support.');
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
      
      // Use redirect on mobile devices for better UX
      const useMobile = isMobileDevice() || isInAppBrowser();
      
      if (useMobile) {
        // Store that we're doing a redirect login
        sessionStorage.setItem('oauth_pending_provider', 'apple');
        await signInWithRedirect(auth, provider);
        // This function won't return - user will be redirected
        return { user: null, session: null };
      }
      
      // Use popup on desktop
      const userCredential: UserCredential = await signInWithPopup(auth, provider, browserPopupRedirectResolver);
      
      // Process the user credential
      return await this.processOAuthCredential(userCredential, 'apple');
    } catch (error: any) {
      // On popup failure, fallback to redirect
      if (error.code === 'auth/popup-blocked' || error.code === 'auth/popup-closed-by-user') {
        try {
          const provider = new OAuthProvider('apple.com');
          provider.addScope('email');
          provider.addScope('name');
          sessionStorage.setItem('oauth_pending_provider', 'apple');
          await signInWithRedirect(auth, provider);
          return { user: null, session: null };
        } catch (redirectError) {
          console.error('Redirect fallback failed:', redirectError);
        }
      }
      
      if (error.code === 'auth/popup-closed-by-user') {
        throw new Error('Sign-in was cancelled. Please try again.');
      }
      if (error.code === 'auth/popup-blocked') {
        throw new Error('Popup was blocked. Redirecting to Apple sign-in...');
      }
      if (error.code === 'auth/cancelled-popup-request') {
        throw new Error('Another sign-in is in progress. Please wait.');
      }
      if (error.code === 'auth/operation-not-allowed') {
        throw new Error('Apple sign-in is not enabled. Please contact support.');
      }
      if (error.code === 'auth/unauthorized-domain') {
        throw new Error('This domain is not authorized for Apple sign-in. Please contact support.');
      }
      if (error.message?.includes('Failed to fetch') || error.message?.includes('NetworkError')) {
        throw new Error('Unable to connect to authentication server. Please check your internet connection.');
      }
      throw error;
    }
  },

  // Helper method to process OAuth credentials (shared between popup and redirect flows)
  async processOAuthCredential(userCredential: UserCredential, provider: 'google' | 'apple'): Promise<{ user: User; session: Session }> {
    // Extract name from additionalUserInfo if available (for Apple)
    let displayName = userCredential.user.displayName;
    if (!displayName && (userCredential as any)._tokenResponse?.fullName) {
      const fullName = (userCredential as any)._tokenResponse.fullName;
      displayName = `${fullName.givenName || ''} ${fullName.familyName || ''}`.trim();
    }
    if (!displayName && (userCredential as any).additionalUserInfo?.profile) {
      const profile = (userCredential as any).additionalUserInfo.profile;
      if (profile.name) {
        displayName = typeof profile.name === 'string' 
          ? profile.name 
          : `${profile.name.givenName || ''} ${profile.name.familyName || ''}`.trim();
      }
    }
    
    // Create or update user document in Firestore
    const userDocRef = doc(db, 'users', userCredential.user.uid);
    const userDocData = {
      id: userCredential.user.uid,
      email: userCredential.user.email,
      full_name: displayName || userCredential.user.displayName || userCredential.user.email?.split('@')[0] || 'User',
      role: 'admin', // Default role, can be updated later
      is_active: true,
      last_login: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      provider,
    };

    try {
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
    } catch (firestoreError) {
      // Don't fail auth if Firestore update fails
      console.warn('Failed to update user document in Firestore:', firestoreError);
    }

    const user = await convertFirebaseUser(userCredential.user);
    const session = await createSession(user);

    return { user, session };
  },

  // Handle redirect result after OAuth redirect (call this on app load)
  async handleRedirectResult(): Promise<{ user: User; session: Session; provider: string } | null> {
    if (isDemoMode) {
      return null;
    }

    try {
      const result = await getRedirectResult(auth);
      
      if (result && result.user) {
        // Get the provider from session storage
        const provider = sessionStorage.getItem('oauth_pending_provider') as 'google' | 'apple' || 'google';
        sessionStorage.removeItem('oauth_pending_provider');
        
        const authResult = await this.processOAuthCredential(result, provider);
        return { ...authResult, provider };
      }
      
      // Clear any pending provider if no result
      sessionStorage.removeItem('oauth_pending_provider');
      return null;
    } catch (error: any) {
      // Clear pending provider on error
      sessionStorage.removeItem('oauth_pending_provider');
      
      console.error('Error handling redirect result:', error);
      
      if (error.code === 'auth/popup-closed-by-user' || error.code === 'auth/cancelled-popup-request') {
        return null; // User cancelled, not an error
      }
      
      throw error;
    }
  },

  // Check if there's a pending OAuth redirect
  hasPendingRedirect(): boolean {
    return sessionStorage.getItem('oauth_pending_provider') !== null;
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

