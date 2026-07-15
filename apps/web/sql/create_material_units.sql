-- Create material_units table for handling alternative units
CREATE TABLE IF NOT EXISTS public.material_units (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    material_id uuid NOT NULL REFERENCES public.materials(id) ON DELETE CASCADE,
    unit_name text NOT NULL,
    conversion_factor numeric NOT NULL CHECK (conversion_factor > 0),
    created_at timestamp with time zone DEFAULT now()
);

-- Index for fast lookup by material_id
CREATE INDEX IF NOT EXISTS idx_material_units_material_id ON public.material_units(material_id);

-- Enable RLS
ALTER TABLE public.material_units ENABLE ROW LEVEL SECURITY;

-- Allow read access to authenticated users
CREATE POLICY "Enable read access for authenticated users on material_units" ON public.material_units
    FOR SELECT
    TO authenticated
    USING (true);

-- Allow write access to authenticated users
CREATE POLICY "Enable insert access for authenticated users on material_units" ON public.material_units
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Enable update access for authenticated users on material_units" ON public.material_units
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Enable delete access for authenticated users on material_units" ON public.material_units
    FOR DELETE
    TO authenticated
    USING (true);
