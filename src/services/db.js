import { supabase } from './supabase';

export async function saveTranscription({ userId, title, rawTranscript, secciones, acciones, durationSeconds, language }) {
  const { data, error } = await supabase
    .from('transcriptions')
    .insert([{
      user_id: userId,
      title,
      raw_transcript: rawTranscript,
      insights: { secciones: secciones || [], acciones: acciones || [] },
      duration_seconds: durationSeconds || null,
      language: language || 'es',
    }])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getTranscriptions(userId) {
  const { data, error } = await supabase
    .from('transcriptions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

export async function deleteTranscription(id) {
  const { error } = await supabase
    .from('transcriptions')
    .delete()
    .eq('id', id);

  if (error) throw error;
}
