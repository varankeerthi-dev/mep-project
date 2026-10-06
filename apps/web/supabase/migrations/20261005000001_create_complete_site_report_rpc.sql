-- Migration: 20261005000001_create_complete_site_report_rpc.sql
-- Description: Define transactional RPCs create_complete_site_report and update_complete_site_report

CREATE OR REPLACE FUNCTION public.create_complete_site_report(
    p_report JSONB,
    p_links JSONB DEFAULT '[]'::jsonb,
    p_children JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_report_id UUID;
    v_sub JSONB;
    v_work JSONB;
    v_milestone JSONB;
    v_req JSONB;
    v_plan JSONB;
    v_instr JSONB;
    v_issue JSONB;
    v_link JSONB;
    v_idx INT;
BEGIN
    INSERT INTO public.site_reports (
        organisation_id,
        project_id,
        client_id,
        report_date,
        total_manpower,
        skilled_manpower,
        unskilled_manpower,
        start_time,
        end_time,
        planned_progress,
        actual_progress,
        percent_complete,
        equipment_on_site,
        breakdown_issues,
        equipment_no_fault,
        equipment_no_fault_notes,
        toolbox_meeting,
        ppe_followed,
        inspection_status,
        satisfied_percent,
        rework_required_reason,
        is_rework,
        rework_reason,
        rework_start,
        rework_end,
        rework_material_used,
        rework_total_manpower,
        doc_type,
        doc_no,
        received_signature,
        dc_invoice_supplied,
        submitted_to_office,
        quote_to_be_sent,
        mail_received,
        pm_status,
        material_arrangement,
        is_filed,
        tools_locked,
        site_pictures_status,
        engineer_name,
        signature_date,
        primary_task_id
    ) VALUES (
        (p_report->>'organisation_id')::UUID,
        (p_report->>'project_id')::UUID,
        (p_report->>'client_id')::UUID,
        (p_report->>'report_date')::DATE,
        p_report->>'total_manpower',
        p_report->>'skilled_manpower',
        p_report->>'unskilled_manpower',
        p_report->>'start_time',
        p_report->>'end_time',
        p_report->>'planned_progress',
        p_report->>'actual_progress',
        p_report->>'percent_complete',
        p_report->>'equipment_on_site',
        p_report->>'breakdown_issues',
        COALESCE((p_report->>'equipment_no_fault')::BOOLEAN, FALSE),
        p_report->>'equipment_no_fault_notes',
        COALESCE((p_report->>'toolbox_meeting')::BOOLEAN, FALSE),
        COALESCE((p_report->>'ppe_followed')::BOOLEAN, FALSE),
        p_report->>'inspection_status',
        p_report->>'satisfied_percent',
        p_report->>'rework_required_reason',
        COALESCE((p_report->>'is_rework')::BOOLEAN, FALSE),
        p_report->>'rework_reason',
        p_report->>'rework_start',
        p_report->>'rework_end',
        p_report->>'rework_material_used',
        p_report->>'rework_total_manpower',
        p_report->>'doc_type',
        p_report->>'doc_no',
        p_report->>'received_signature',
        COALESCE((p_report->>'dc_invoice_supplied')::BOOLEAN, FALSE),
        COALESCE((p_report->>'submitted_to_office')::BOOLEAN, FALSE),
        COALESCE((p_report->>'quote_to_be_sent')::BOOLEAN, FALSE),
        COALESCE((p_report->>'mail_received')::BOOLEAN, FALSE),
        COALESCE(p_report->>'pm_status', 'Pending'),
        p_report->>'material_arrangement',
        COALESCE((p_report->>'is_filed')::BOOLEAN, FALSE),
        COALESCE((p_report->>'tools_locked')::BOOLEAN, FALSE),
        p_report->>'site_pictures_status',
        p_report->>'engineer_name',
        (p_report->>'signature_date')::DATE,
        (p_report->>'primary_task_id')::UUID
    )
    RETURNING id INTO v_report_id;

    -- Subcontractors
    IF p_children ? 'subContractors' THEN
        FOR v_sub IN SELECT * FROM jsonb_array_elements(p_children->'subContractors')
        LOOP
            IF (v_sub->>'name') IS NOT NULL AND trim(v_sub->>'name') <> '' THEN
                INSERT INTO public.sub_contractors (report_id, name, count, start_time, end_time, subcontractor_id)
                VALUES (
                    v_report_id,
                    v_sub->>'name',
                    v_sub->>'count',
                    v_sub->>'start',
                    v_sub->>'end',
                    (v_sub->>'subcontractor_id')::UUID
                );
            END IF;
        END LOOP;
    END IF;

    -- Work Carried Out
    IF p_children ? 'workCarriedOut' THEN
        FOR v_work IN SELECT * FROM jsonb_array_elements(p_children->'workCarriedOut')
        LOOP
            IF (v_work->>'value') IS NOT NULL AND trim(v_work->>'value') <> '' THEN
                INSERT INTO public.work_carried_out (report_id, description, trade)
                VALUES (v_report_id, v_work->>'value', COALESCE(v_work->>'trade', 'General'));
            END IF;
        END LOOP;
    END IF;

    -- Milestones
    IF p_children ? 'milestonesCompleted' THEN
        FOR v_milestone IN SELECT * FROM jsonb_array_elements(p_children->'milestonesCompleted')
        LOOP
            IF (v_milestone->>'value') IS NOT NULL AND trim(v_milestone->>'value') <> '' THEN
                INSERT INTO public.milestones_completed (report_id, description)
                VALUES (v_report_id, v_milestone->>'value');
            END IF;
        END LOOP;
    END IF;

    -- Client Requirements
    IF p_children ? 'clientRequirements' THEN
        v_idx := 0;
        FOR v_req IN SELECT * FROM jsonb_array_elements(p_children->'clientRequirements')
        LOOP
            IF (v_req->>'value') IS NOT NULL AND trim(v_req->>'value') <> '' THEN
                INSERT INTO public.site_report_client_requirements (report_id, description, sort_order)
                VALUES (v_report_id, v_req->>'value', v_idx);
                v_idx := v_idx + 1;
            END IF;
        END LOOP;
    END IF;

    -- Work Plan Next Day
    IF p_children ? 'workPlanNextDay' THEN
        v_idx := 0;
        FOR v_plan IN SELECT * FROM jsonb_array_elements(p_children->'workPlanNextDay')
        LOOP
            IF (v_plan->>'value') IS NOT NULL AND trim(v_plan->>'value') <> '' THEN
                INSERT INTO public.site_report_work_plan_next_day (report_id, description, sort_order)
                VALUES (v_report_id, v_plan->>'value', v_idx);
                v_idx := v_idx + 1;
            END IF;
        END LOOP;
    END IF;

    -- Special Instructions
    IF p_children ? 'specialInstructions' THEN
        v_idx := 0;
        FOR v_instr IN SELECT * FROM jsonb_array_elements(p_children->'specialInstructions')
        LOOP
            IF (v_instr->>'value') IS NOT NULL AND trim(v_instr->>'value') <> '' THEN
                INSERT INTO public.site_report_special_instructions (report_id, description, sort_order)
                VALUES (v_report_id, v_instr->>'value', v_idx);
                v_idx := v_idx + 1;
            END IF;
        END LOOP;
    END IF;

    -- Issues Faced
    IF p_children ? 'issuesFaced' THEN
        v_idx := 0;
        FOR v_issue IN SELECT * FROM jsonb_array_elements(p_children->'issuesFaced')
        LOOP
            IF (v_issue->>'issue') IS NOT NULL AND trim(v_issue->>'issue') <> '' THEN
                INSERT INTO public.site_report_issues_faced (report_id, issue, solution, sort_order)
                VALUES (v_report_id, v_issue->>'issue', v_issue->>'solution', v_idx);
                v_idx := v_idx + 1;
            END IF;
        END LOOP;
    END IF;

    -- Task Links
    IF jsonb_array_length(p_links) > 0 THEN
        FOR v_link IN SELECT * FROM jsonb_array_elements(p_links)
        LOOP
            IF (v_link->>'task_id') IS NOT NULL THEN
                INSERT INTO public.report_task_links (report_id, task_id)
                VALUES (v_report_id, (v_link->>'task_id')::UUID);
            END IF;
        END LOOP;
    END IF;

    RETURN v_report_id;
END;
$$;
