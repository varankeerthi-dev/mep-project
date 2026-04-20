-- Fix existing tables (add missing columns if not exist)
ALTER TABLE discount_structures ADD COLUMN IF NOT EXISTS organisation_id UUID REFERENCES organisations(id);
ALTER TABLE discount_variant_settings ADD COLUMN IF NOT EXISTS organisation_id UUID REFERENCES organisations(id);
ALTER TABLE discount_variant_settings ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Create document_settings if not exists
CREATE TABLE IF NOT EXISTS document_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organisation_id UUID REFERENCES organisations(id),
    template_name VARCHAR(255),
    template_content TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create users table if not exists (skip if exists, handle auth.users conflict)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users' AND table_schema = 'public') THEN
        CREATE TABLE users (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            organisation_id UUID REFERENCES organisations(id),
            user_id UUID REFERENCES auth.users(id),
            role VARCHAR(50) DEFAULT 'user',
            is_active BOOLEAN DEFAULT true,
            created_at TIMESTAMPTZ DEFAULT NOW()
        );
    END IF;
END $$;

-- Create user_profiles table if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_profiles' AND table_schema = 'public') THEN
        CREATE TABLE user_profiles (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID REFERENCES auth.users(id) UNIQUE,
            organisation_id UUID REFERENCES organisations(id),
            full_name VARCHAR(255),
            phone VARCHAR(50),
            role VARCHAR(50) DEFAULT 'user',
            created_at TIMESTAMPTZ DEFAULT NOW()
        );
    END IF;
END $$;

-- Enable RLS on tables (skip if already enabled)
ALTER TABLE document_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Create policies only if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view document_settings' AND tablename = 'document_settings') THEN
        CREATE POLICY "Users can view document_settings" ON document_settings FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can insert document_settings' AND tablename = 'document_settings') THEN
        CREATE POLICY "Users can insert document_settings" ON document_settings FOR INSERT WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can update document_settings' AND tablename = 'document_settings') THEN
        CREATE POLICY "Users can update document_settings" ON document_settings FOR UPDATE USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can delete document_settings' AND tablename = 'document_settings') THEN
        CREATE POLICY "Users can delete document_settings" ON document_settings FOR DELETE USING (true);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view users' AND tablename = 'users') THEN
        CREATE POLICY "Users can view users" ON users FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can insert users' AND tablename = 'users') THEN
        CREATE POLICY "Users can insert users" ON users FOR INSERT WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can update users' AND tablename = 'users') THEN
        CREATE POLICY "Users can update users" ON users FOR UPDATE USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can delete users' AND tablename = 'users') THEN
        CREATE POLICY "Users can delete users" ON users FOR DELETE USING (true);
    END IF;
END $$;