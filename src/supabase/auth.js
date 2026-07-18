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
    mockUser = { id: 'mock-uid-123', email, user_metadata: { display_name: displayName } };
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
    // Basic verification for testing
    mockUser = { id: 'mock-uid-123', email, user_metadata: { display_name: 'Garry Developer' } };
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
    mockUser = { id: 'mock-uid-123', email: 'developer@garrytor.com', user_metadata: { display_name: 'Garry Developer' } };
    localStorage.setItem('garrytor_mock_user', JSON.stringify(mockUser));
    triggerMockAuthChange('SIGNED_IN', { user: mockUser });
    return { data: { user: mockUser }, error: null };
  }

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin
    }
  });
  return { data, error };
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
