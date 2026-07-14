import React, { useState } from 'react';
import { supabase, isSupabaseConfigured } from '../supabaseClient';
import { ShieldCheck, Mail, Lock, ArrowRight, Loader2, AlertCircle } from 'lucide-react';

interface LoginPanelProps {
  onLocalLogin: () => void;
}

export default function LoginPanel({ onLocalLogin }: LoginPanelProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    // Modo Offline / Sandbox
    if (!isSupabaseConfigured()) {
      setTimeout(() => {
        onLocalLogin();
        setLoading(false);
      }, 800);
      return;
    }

    // Modo Supabase Real
    if (supabase) {
      try {
        if (isLogin) {
          const { error: signInError } = await supabase.auth.signInWithPassword({
            email,
            password,
          });
          if (signInError) throw signInError;
        } else {
          const { error: signUpError } = await supabase.auth.signUp({
            email,
            password,
          });
          if (signUpError) throw signUpError;
          else {
            alert('Conta criada com sucesso! Você já pode fazer login.');
            setIsLogin(true);
          }
        }
      } catch (err: any) {
        setError(err.message || 'Ocorreu um erro na autenticação.');
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 relative overflow-hidden font-sans">
      {/* Background Decorations */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-200/40 blur-[100px] rounded-full pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-violet-200/40 blur-[100px] rounded-full pointer-events-none"></div>

      <div className="w-full max-w-md relative z-10">
        {/* Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex bg-gradient-to-tr from-indigo-600 to-violet-600 p-3.5 rounded-2xl text-white shadow-lg shadow-indigo-600/20 mb-4">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Gestão de Processos
          </h1>
          <p className="text-sm font-medium text-slate-500 mt-1">
            Faça login para acessar o sistema unificador.
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-white/80 backdrop-blur-xl p-8 rounded-3xl shadow-[0_8px_30px_-4px_rgba(0,0,0,0.04)] border border-slate-200/60">
          <form onSubmit={handleAuth} className="space-y-5">
            {error && (
              <div className="bg-rose-50/50 border border-rose-100/80 p-3.5 rounded-2xl flex items-start space-x-3 text-rose-600 text-xs font-bold shadow-inner">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {!isSupabaseConfigured() && (
              <div className="bg-amber-50/50 border border-amber-200/80 p-3.5 rounded-2xl flex items-start space-x-3 text-amber-700 text-xs font-bold shadow-inner mb-4">
                <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
                <span>Modo Sandbox: Supabase não detectado. Você pode entrar com qualquer e-mail e senha.</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wider block ml-1">
                E-mail
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Mail className="w-4 h-4 text-slate-400" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  className="w-full text-sm pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 transition-all font-medium text-slate-800 placeholder:text-slate-400"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wider block ml-1">
                Senha
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="w-4 h-4 text-slate-400" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full text-sm pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 transition-all font-medium text-slate-800 placeholder:text-slate-400"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center space-x-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-70 disabled:hover:bg-indigo-600 text-white font-bold py-3.5 px-4 rounded-2xl transition-all shadow-md shadow-indigo-600/10 mt-6 active:scale-[0.98]"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <span>{isLogin ? 'Entrar no Sistema' : 'Criar Conta'}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {isSupabaseConfigured() && (
            <div className="mt-6 text-center">
              <button
                onClick={() => {
                  setIsLogin(!isLogin);
                  setError(null);
                }}
                className="text-xs font-bold text-slate-500 hover:text-indigo-600 transition-colors"
              >
                {isLogin
                  ? 'Não tem uma conta? Cadastre-se'
                  : 'Já tem uma conta? Entrar'}
              </button>
            </div>
          )}
        </div>
        
        <p className="text-center text-[10px] text-slate-400 font-medium mt-8">
          © 2026 Gestão Inteligente de Documentos
        </p>
      </div>
    </div>
  );
}
