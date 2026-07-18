import { supabase } from './config';

const isConfigured = () => {
  return supabase !== null;
};

// Mock user session helper for fallback mode
let mockUser = JSON.parse(localStorage.getItem('garrytor_mock_user') || 'null');
let mockListeners = [];

const triggerMockAuthChange = (event, session) => {
  mockListeners.forEach(cb => cb(event, session));
};

export const signUpWithEmail = async (email, password, displayName) => {
  if (!isConfigured()) {
    mockUser = { id: `mock-${Date.now()}`, email, user_metadata: { display_name: displayName } };
    localStorage.setItem('garrytor_mock_user', JSON.stringify(mockUser));
    triggerMockAuthChange('SIGNED_IN', { user: mockUser });
    return { data: { user: mockUser }, error: null };
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { display_name: displayName }
    }
  });
  return { data, error };
};

export const signInWithEmail = async (email, password) => {
  if (!isConfigured()) {
    mockUser = { id: `mock-${Date.now()}`, email, user_metadata: { display_name: email.split('@')[0] } };
    localStorage.setItem('garrytor_mock_user', JSON.stringify(mockUser));
    triggerMockAuthChange('SIGNED_IN', { user: mockUser });
    return { data: { user: mockUser }, error: null };
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });
  return { data, error };
};

export const signInWithGoogle = async () => {
  if (!isConfigured()) {
    // Mock mode: show a clear error instead of faking a login
    return { data: null, error: new Error('Google Sign-In requires Supabase to be configured. Please use email/password or configure your .env file.') };
  }

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin
    }
  });
  // OAuth triggers a full browser redirect — do NOT call onLoginSuccess here.
  // The session will be picked up by onAuthStateChange after the redirect back.
  return { data, error, isRedirect: true };
};

export const signOut = async () => {
  if (!isConfigured()) {
    mockUser = null;
    localStorage.removeItem('garrytor_mock_user');
    triggerMockAuthChange('SIGNED_OUT', null);
    return { error: null };
  }

  const { error } = await supabase.auth.signOut();
  return { error };
};

export const onAuthStateChange = (callback) => {
  if (!isConfigured()) {
    mockListeners.push(callback);
    // Initial check
    setTimeout(() => {
      if (mockUser) {
        callback('SIGNED_IN', { user: mockUser });
      } else {
        callback('SIGNED_OUT', null);
      }
    }, 50);
    
    // Return unsubscribe function
    return {
      data: {
        subscription: {
          unsubscribe: () => {
            mockListeners = mockListeners.filter(cb => cb !== callback);
          }
        }
      }
    };
  }

  return supabase.auth.onAuthStateChange(callback);
};

export const getCurrentUser = async () => {
  if (!isConfigured()) {
    return mockUser;
  }

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) return null;
  return user;
};

// Helper to extract display name from any auth provider's user_metadata
export const getUserDisplayName = (user) => {
  if (!user) return 'User';
  const meta = user.user_metadata || {};
  return meta.display_name || meta.full_name || meta.name || meta.preferred_username || (user.email ? user.email.split('@')[0] : 'User');
};
