// Test file to verify Resend email functionality
// Run this with: npx tsx src/utils/testEmail.ts

import { sendOnboardingSuccessEmail, sendSimpleTestEmail } from './emailService';

async function testEmail() {
  console.log('Testing Resend email service...');
  
  // Test simple email
  console.log('\n1. Testing simple test email...');
  const simpleResult = await sendSimpleTestEmail('varankeerthi@gmail.com');
  console.log('Simple email result:', simpleResult);
  
  // Test onboarding email
  console.log('\n2. Testing onboarding success email...');
  const onboardingResult = await sendOnboardingSuccessEmail({
    to: 'varankeerthi@gmail.com',
    fullName: 'Test User',
    organisationName: 'Test Organization'
  });
  console.log('Onboarding email result:', onboardingResult);
  
  console.log('\nTest completed!');
}

testEmail().catch(console.error);
