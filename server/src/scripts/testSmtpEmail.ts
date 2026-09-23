import dotenv from 'dotenv';
import path from 'path';
import { sendOtpEmail } from '../services/email';

dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

async function testEmail() {
  console.log('--- Testing SMTP Verification Email Delivery ---');
  console.log('SMTP_HOST:', process.env.SMTP_HOST);
  console.log('SMTP_PORT:', process.env.SMTP_PORT);
  console.log('SMTP_USER:', process.env.SMTP_USER);

  try {
    const result = await sendOtpEmail('chittesh134@gmail.com', '654321', 'Forgot PIN Test');
    console.log('✅ Email Result:', result);
    console.log('Live email delivery test PASSED!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Email test failed:', err);
    process.exit(1);
  }
}

testEmail();
