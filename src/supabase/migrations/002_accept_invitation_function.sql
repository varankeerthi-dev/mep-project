-- Accept Invitation Function
-- SQL function to handle invitation acceptance in a transaction
CREATE OR REPLACE FUNCTION accept_invitation(
    token_param TEXT,
    user_id_param UUID
)
RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
    invitation_record RECORD;
    org_record RECORD;
    membership_record RECORD;
    invitation_valid BOOLEAN := FALSE;
    invitation_expired BOOLEAN := FALSE;
    user_exists BOOLEAN := FALSE;
    
BEGIN
    -- Get invitation details
    SELECT * INTO invitation_record 
    FROM invitations 
    WHERE token = token_param;
    
    -- Check if invitation exists and is valid
    IF invitation_record.id IS NOT NULL THEN
        invitation_valid := TRUE;
        
        -- Check if invitation is expired
        IF invitation_record.expires_at < NOW() THEN
            invitation_expired := TRUE;
        END IF;
        
        -- Check if user already exists in system
        SELECT EXISTS(SELECT 1 FROM user_profiles WHERE id = user_id_param) INTO user_exists;
        
        -- Only proceed if invitation is valid and not expired and user doesn't exist
        IF invitation_valid = TRUE AND invitation_expired = FALSE AND user_exists = FALSE THEN
            -- Get organization details
            SELECT * INTO org_record 
            FROM organisations 
            WHERE id = invitation_record.organisation_id;
            
            -- Create user-organization membership
            INSERT INTO user_organisations (
                user_id,
                organisation_id,
                role,
                status,
                joined_at,
                is_default,
                trial_ends_at
            ) VALUES (
                user_id_param,
                invitation_record.organisation_id,
                invitation_record.role,
                'active',
                NOW(),
                TRUE,
                CASE 
                    WHEN org_record.trial_period_days IS NOT NULL 
                    THEN NOW() + (org_record.trial_period_days || '30 days')::INTERVAL
                    ELSE NULL
                END
            );
            
            -- Update invitation status
            UPDATE invitations 
            SET status = 'accepted', 
                accepted_at = NOW(),
                accepted_by_user_id = user_id_param
            WHERE id = invitation_record.id;
            
            -- Update user profile with organization role
            UPDATE user_profiles 
            SET role = invitation_record.role 
            WHERE id = user_id_param;
            
            RETURN json_build_object(
                'success', TRUE,
                'message', 'Invitation accepted successfully',
                'organisation_id', invitation_record.organisation_id,
                'role', invitation_record.role
            );
        ELSE
            RETURN json_build_object(
                'success', FALSE,
                'message', CASE 
                    WHEN invitation_record.id IS NULL THEN 'Invalid invitation token'
                    WHEN invitation_expired THEN 'Invitation has expired'
                    WHEN user_exists THEN 'User already exists in system'
                    ELSE 'Invalid invitation'
                END
            );
        END IF;
    ELSE
        RETURN json_build_object(
            'success', FALSE,
            'message', 'Invalid invitation token'
        );
    END IF;
END;
$$;
