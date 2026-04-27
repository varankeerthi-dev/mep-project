import { Resend } from 'resend';

const resend = new Resend(import.meta.env.VITE_RESEND_API_KEY || 're_kFJ1os9G_Bz8TfFUcSBX375ePe4jAs41v');

export interface SendOnboardingEmailParams {
  to: string;
  fullName?: string;
  organisationName?: string;
}

export async function sendOnboardingSuccessEmail({
  to,
  fullName = 'User',
  organisationName = 'your organization'
}: SendOnboardingEmailParams) {
  try {
    const { data, error } = await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: to,
      subject: 'Welcome to Perfect ERP - Your Account is Ready!',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Welcome to Perfect ERP</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #007AFF 0%, #5856D6 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 28px;">Perfect ERP</h1>
          </div>
          
          <div style="background: #f9f9f9; padding: 40px; border-radius: 0 0 10px 10px;">
            <h2 style="color: #007AFF; margin-top: 0;">Welcome aboard, ${fullName}! 🎉</h2>
            
            <p>Congratulations on successfully creating your account with <strong>${organisationName}</strong> on Perfect ERP!</p>
            
            <p>Your account is now ready and you can start managing your projects, clients, invoices, and much more.</p>
            
            <div style="background: white; padding: 20px; border-left: 4px solid #007AFF; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #333;">What's Next?</h3>
              <ul style="margin-bottom: 0;">
                <li>✅ Log in to your dashboard</li>
                <li>✅ Create your first project</li>
                <li>✅ Add clients and team members</li>
                <li>✅ Start sending invoices</li>
              </ul>
            </div>
            
            <p style="text-align: center; margin: 30px 0;">
              <a href="${window.location.origin}/#login" style="background: #007AFF; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Access Your Dashboard</a>
            </p>
            
            <p style="font-size: 14px; color: #666; margin-top: 30px;">
              If you have any questions, feel free to reach out to our support team.
            </p>
            
            <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
            
            <p style="font-size: 12px; color: #999; text-align: center; margin: 0;">
              © 2026 Perfect ERP. All rights reserved.<br>
              You received this email because you signed up for a Perfect ERP account.
            </p>
          </div>
        </body>
        </html>
      `
    });

    if (error) {
      console.error('Error sending email:', error);
      return { success: false, error };
    }

    return { success: true, data };
  } catch (error) {
    console.error('Error in sendOnboardingSuccessEmail:', error);
    return { success: false, error };
  }
}

export async function sendSimpleTestEmail(to: string) {
  try {
    const { data, error } = await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: to,
      subject: 'Hello World',
      html: '<p>Congrats on sending your <strong>first email</strong>!</p>'
    });

    if (error) {
      console.error('Error sending email:', error);
      return { success: false, error };
    }

    return { success: true, data };
  } catch (error) {
    console.error('Error in sendSimpleTestEmail:', error);
    return { success: false, error };
  }
}
