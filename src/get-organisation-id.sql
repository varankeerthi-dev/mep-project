-- Run this query to get your actual organisation ID
SELECT id, name FROM organisations WHERE id = (
    SELECT organisation_id FROM user_organisations 
    WHERE user_id = auth.uid() 
    LIMIT 1
);
