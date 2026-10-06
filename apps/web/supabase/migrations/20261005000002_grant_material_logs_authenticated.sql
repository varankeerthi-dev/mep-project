-- Migration: 20261005000002_grant_material_logs_authenticated.sql
-- Description: Grant permissions and RLS policies on material_logs for authenticated users

GRANT ALL ON TABLE public.material_logs TO authenticated;
GRANT ALL ON TABLE public.material_logs TO service_role;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'material_logs' 
        AND policyname = 'authenticated_all_material_logs'
    ) THEN
        CREATE POLICY authenticated_all_material_logs ON public.material_logs
            FOR ALL TO authenticated
            USING (true)
            WITH CHECK (true);
    END IF;
END $$;
