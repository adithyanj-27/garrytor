import { supabase } from './config';

const isConfigured = () => {
  return supabase !== null;
};

// --- Local Storage Database Mocks ---
const getLocalProjects = () => JSON.parse(localStorage.getItem('garrytor_projects') || '[]');
const saveLocalProjects = (projects) => localStorage.setItem('garrytor_projects', JSON.stringify(projects));

const getLocalPresets = () => JSON.parse(localStorage.getItem('garrytor_presets') || '[]');
const saveLocalPresets = (presets) => localStorage.setItem('garrytor_presets', JSON.stringify(presets));

// --- Database API Exports ---

export const getProjects = async (userId) => {
  if (!isConfigured() || userId === 'guest') {
    const projects = getLocalProjects().filter(p => p.user_id === userId);
    return { data: projects.sort((a,b) => new Date(b.created_at) - new Date(a.created_at)), error: null };
  }

  try {
    const { data: userData } = await supabase.auth.getUser();
    const effectiveUserId = (userData && userData.user) ? userData.user.id : userId;

    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('user_id', effectiveUserId)
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Supabase getProjects failed, returning local projects:', error.message);
      const projects = getLocalProjects();
      return { data: projects.sort((a,b) => new Date(b.created_at) - new Date(a.created_at)), error: null };
    }

    const localProjects = getLocalProjects();
    const allProjects = [...(data || []), ...localProjects];
    return { data: allProjects, error: null };
  } catch (err) {
    const projects = getLocalProjects();
    return { data: projects.sort((a,b) => new Date(b.created_at) - new Date(a.created_at)), error: null };
  }
};

export const getProject = async (projectId, userId) => {
  const isLocal = !isConfigured() || (projectId && projectId.toString().startsWith('proj-')) || userId === 'guest';
  if (isLocal) {
    const projects = getLocalProjects();
    const proj = projects.find(p => p.id === projectId);
    return { data: proj || null, error: proj ? null : new Error('Project not found') };
  }

  try {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single();

    if (error) {
      const projects = getLocalProjects();
      const proj = projects.find(p => p.id === projectId);
      return { data: proj || null, error: proj ? null : error };
    }

    return { data, error: null };
  } catch (err) {
    const projects = getLocalProjects();
    const proj = projects.find(p => p.id === projectId);
    return { data: proj || null, error: proj ? null : err };
  }
};

export const createProject = async (userId, name, originalPath, thumbnailPath) => {
  const isGuest = userId === 'guest';
  const newProject = {
    user_id: userId,
    name,
    original_path: originalPath,
    thumbnail_path: thumbnailPath,
    edit_state: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  if (!isConfigured() || isGuest) {
    newProject.id = `proj-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const projects = getLocalProjects();
    projects.push(newProject);
    saveLocalProjects(projects);
    return { data: newProject, error: null };
  }

  try {
    const { data: userData } = await supabase.auth.getUser();
    if (userData && userData.user) {
      newProject.user_id = userData.user.id;
    }

    const { data, error } = await supabase
      .from('projects')
      .insert([newProject])
      .select()
      .single();

    if (error) {
      console.warn('Supabase DB insert failed (falling back to local storage):', error.message);
      newProject.id = `proj-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const projects = getLocalProjects();
      projects.push(newProject);
      saveLocalProjects(projects);
      return { data: newProject, error: null };
    }

    return { data, error: null };
  } catch (err) {
    console.warn('Supabase DB error (falling back to local storage):', err.message);
    newProject.id = `proj-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const projects = getLocalProjects();
    projects.push(newProject);
    saveLocalProjects(projects);
    return { data: newProject, error: null };
  }
};

export const updateProjectState = async (projectId, editState, thumbnailPath = null) => {
  const updateData = {
    edit_state: editState,
    updated_at: new Date().toISOString()
  };
  
  if (thumbnailPath) {
    updateData.thumbnail_path = thumbnailPath;
  }

  const isLocal = !isConfigured() || (projectId && projectId.toString().startsWith('proj-'));

  if (isLocal) {
    const projects = getLocalProjects();
    const idx = projects.findIndex(p => p.id === projectId);
    if (idx !== -1) {
      projects[idx] = { ...projects[idx], ...updateData };
      saveLocalProjects(projects);
      return { data: projects[idx], error: null };
    }
    return { data: null, error: new Error('Project not found') };
  }

  try {
    const { data, error } = await supabase
      .from('projects')
      .update(updateData)
      .eq('id', projectId)
      .select()
      .single();

    if (error) {
      const projects = getLocalProjects();
      const idx = projects.findIndex(p => p.id === projectId);
      if (idx !== -1) {
        projects[idx] = { ...projects[idx], ...updateData };
        saveLocalProjects(projects);
        return { data: projects[idx], error: null };
      }
    }

    return { data, error };
  } catch (err) {
    const projects = getLocalProjects();
    const idx = projects.findIndex(p => p.id === projectId);
    if (idx !== -1) {
      projects[idx] = { ...projects[idx], ...updateData };
      saveLocalProjects(projects);
      return { data: projects[idx], error: null };
    }
    return { data: null, error: err };
  }
};

export const deleteProject = async (projectId) => {
  const isLocal = !isConfigured() || (projectId && projectId.toString().startsWith('proj-'));

  if (isLocal) {
    const projects = getLocalProjects();
    const updated = projects.filter(p => p.id !== projectId);
    saveLocalProjects(updated);
    return { error: null };
  }

  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('id', projectId);

  return { error };
};

export const getPresets = async (userId) => {
  if (!isConfigured() || userId === 'guest') {
    const presets = getLocalPresets().filter(p => p.user_id === userId);
    return { data: presets, error: null };
  }

  const { data, error } = await supabase
    .from('presets')
    .select('*')
    .eq('user_id', userId);

  return { data, error };
};

export const savePreset = async (userId, name, settings) => {
  const isGuest = userId === 'guest';
  const newPreset = {
    id: (isConfigured() && !isGuest) ? undefined : `preset-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    user_id: userId,
    name,
    settings,
    created_at: new Date().toISOString()
  };

  if (!isConfigured() || isGuest) {
    const presets = getLocalPresets();
    presets.push(newPreset);
    saveLocalPresets(presets);
    return { data: newPreset, error: null };
  }

  const { data, error } = await supabase
    .from('presets')
    .insert([newPreset])
    .select()
    .single();

  return { data, error };
};

export const deletePreset = async (presetId) => {
  const isLocal = !isConfigured() || (presetId && presetId.toString().startsWith('preset-'));

  if (isLocal) {
    const presets = getLocalPresets();
    const updated = presets.filter(p => p.id !== presetId);
    saveLocalPresets(updated);
    return { error: null };
  }

  const { error } = await supabase
    .from('presets')
    .delete()
    .eq('id', presetId);

  return { error };
};
