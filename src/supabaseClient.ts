/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { createClient } from '@supabase/supabase-js';

// Usamos as variáveis com prefixo VITE_ para que fiquem disponíveis no frontend com Vite.
const env = (import.meta as any).env || {};
const supabaseUrl = env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = (): boolean => {
  return typeof supabaseUrl === 'string' && supabaseUrl.trim() !== '' &&
         typeof supabaseAnonKey === 'string' && supabaseAnonKey.trim() !== '';
};

// Cliente Supabase inicializado de forma segura
export const supabase = isSupabaseConfigured()
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

/**
 * Utilitários para sincronizar ou gerenciar dados localmente
 * quando o Supabase não está configurado, servindo como um sandbox de simulação perfeito.
 */
export const getLocalData = <T>(key: string, defaultValue: T): T => {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : defaultValue;
  } catch (error) {
    console.warn('Erro ao carregar dados do localStorage:', error);
    return defaultValue;
  }
};

export const saveLocalData = <T>(key: string, value: T): void => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn('Erro ao salvar dados no localStorage:', error);
  }
};
