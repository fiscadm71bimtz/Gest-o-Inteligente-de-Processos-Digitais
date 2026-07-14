-- Habilitar a extensão para gerar UUIDs se necessário
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Tabela: tipos_processo
CREATE TABLE IF NOT EXISTS public.tipos_processo (
  id TEXT PRIMARY KEY,
  titulo TEXT NOT NULL,
  descricao TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Tabela: requisitos_documento
CREATE TABLE IF NOT EXISTS public.requisitos_documento (
  id TEXT PRIMARY KEY,
  tipo_processo_id TEXT REFERENCES public.tipos_processo(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  descricao TEXT,
  obrigatorio BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Tabela: processos
CREATE TABLE IF NOT EXISTS public.processos (
  id TEXT PRIMARY KEY,
  tipo_processo_id TEXT REFERENCES public.tipos_processo(id) ON DELETE SET NULL,
  requerente_nome TEXT NOT NULL,
  cpf_cnpj TEXT,
  status TEXT DEFAULT 'rascunho',
  pdf_unificado_url TEXT,
  pdf_unificado_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Tabela: documentos_anexados
CREATE TABLE IF NOT EXISTS public.documentos_anexados (
  id TEXT PRIMARY KEY,
  processo_id TEXT REFERENCES public.processos(id) ON DELETE CASCADE,
  requisito_id TEXT, -- Pode ser nulo para documentos avulsos
  nome_arquivo TEXT NOT NULL,
  url_storage TEXT NOT NULL,
  extensao TEXT,
  tamanho BIGINT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Configuração de Storage (Buckets)
-- É necessário executar isso como SuperUser no Supabase ou via Dashboard se não tiver permissão
INSERT INTO storage.buckets (id, name, public) 
VALUES 
  ('documentos-brutos', 'documentos-brutos', true),
  ('processos-unificados', 'processos-unificados', true)
ON CONFLICT (id) DO NOTHING;

-- 6. Configuração de Políticas (RLS - Row Level Security)
-- Habilitando acesso público temporário (Modo Desenvolvimento)
-- *Em produção, ajuste essas políticas para exigir autenticação*

ALTER TABLE public.tipos_processo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.requisitos_documento ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documentos_anexados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir acesso total público em tipos_processo" ON public.tipos_processo FOR ALL USING (true);
CREATE POLICY "Permitir acesso total público em requisitos_documento" ON public.requisitos_documento FOR ALL USING (true);
CREATE POLICY "Permitir acesso total público em processos" ON public.processos FOR ALL USING (true);
CREATE POLICY "Permitir acesso total público em documentos_anexados" ON public.documentos_anexados FOR ALL USING (true);

-- Políticas de Storage (Permitir acesso público aos arquivos)
CREATE POLICY "Acesso público ao bucket documentos-brutos" 
  ON storage.objects FOR ALL 
  USING (bucket_id = 'documentos-brutos');

CREATE POLICY "Acesso público ao bucket processos-unificados" 
  ON storage.objects FOR ALL 
  USING (bucket_id = 'processos-unificados');

-- 7. Tabela: perfis (Cadastro de Usuários Vinculado ao Auth)
CREATE TABLE IF NOT EXISTS public.perfis (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  nome_completo TEXT,
  funcao TEXT DEFAULT 'usuario',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.perfis ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS para perfis
CREATE POLICY "Permitir leitura do próprio perfil" ON public.perfis 
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Permitir atualização do próprio perfil" ON public.perfis 
  FOR UPDATE USING (auth.uid() = id);

-- Trigger para criar o perfil automaticamente ao cadastrar um usuário na autenticação do Supabase
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.perfis (id, email)
  VALUES (new.id, new.email);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Remove o trigger se já existir para evitar erro ao rodar o script novamente
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
