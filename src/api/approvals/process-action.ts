import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const config = {
  runtime: 'edge',
};

export default async function handler(req: NextRequest) {
  if (req.method !== 'POST') {
    return new NextResponse('Method not allowed', { status: 405 });
  }

  try {
    const { approval_id, action, comments } = await req.json();
    const supabase = createClient();

    // Get the approval to update
    const { data: approval } = await supabase
      .from('approvals')
      .select(`
        *,
        reference_document:quotation_header!inner(
          id,
          quotation_no,
          client_id,
          grand_total
        )
      `)
      .eq('id', approval_id)
      .single();

    if (!approval) {
      return new NextResponse('Approval not found', { status: 404 });
    }

    // Process the approval action
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    // Update the approval status
    const newStatus = action === 'APPROVED' ? 'APPROVED' : 'REJECTED';
    
    const { error } = await supabase
      .from('approvals')
      .update({
        status: newStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', approval_id);

    if (error) {
      console.error('Error updating approval:', error);
      return new NextResponse('Failed to update approval', { status: 500 });
    }

    // Update the reference document status
    if (approval.reference_document) {
      const { error: docError } = await supabase
        .from('quotation_header')
        .update({
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', approval.reference_document.id);

      if (docError) {
        console.error('Error updating quotation:', docError);
      }
    }

    // Log the approval action
    await supabase
      .from('approval_actions')
      .insert({
        approval_id,
        action,
        comments,
        approver_id: user.id,
        ip_address: req.ip || '127.0.0.1',
        user_agent: req.headers.get('user-agent') || '',
        action_at: new Date().toISOString()
      });

    return new NextResponse(
      JSON.stringify({ 
        success: true, 
        message: `Quotation ${newStatus.toLowerCase()} successfully` 
      }),
      { status: 200 }
    );

  } catch (error) {
    console.error('Error processing approval action:', error);
    return new NextResponse('Internal server error', { status: 500 });
  }
}
