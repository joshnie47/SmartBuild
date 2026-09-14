const nodemailer = require('nodemailer');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from server/.env
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function testEmail() {
  console.log('=== Nodemailer Gmail SMTP Verification Test ===');
  console.log(`EMAIL_USER: ${process.env.EMAIL_USER || '(NOT CONFIGURED)'}`);
  console.log(`EMAIL_PASS: ${process.env.EMAIL_PASS ? '********' + process.env.EMAIL_PASS.slice(-4) : '(NOT CONFIGURED)'}`);

  if (!process.env.EMAIL_USER || process.env.EMAIL_USER === 'your_email@gmail.com' || !process.env.EMAIL_PASS || process.env.EMAIL_PASS === 'your_16_char_google_app_password') {
    console.error('\n❌ Error: EMAIL_USER and EMAIL_PASS must be set with valid Gmail credentials in server/.env before running this test.');
    console.log('Generate a 16-character Google App Password at: https://myaccount.google.com/apppasswords');
    process.exit(1);
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  console.log('\n[1/2] Verifying SMTP connection to Gmail...');
  try {
    await transporter.verify();
    console.log('✅ Connection to Gmail SMTP server successful!');
  } catch (error) {
    console.error('❌ Gmail SMTP Verification Failed:', error);
    process.exit(1);
  }

  console.log('\n[2/2] Sending test OTP email...');
  const testOtp = Math.floor(100000 + Math.random() * 900000).toString();
  const recipient = process.env.EMAIL_USER;

  try {
    const info = await transporter.sendMail({
      from: `"SmartBuild Test" <${process.env.EMAIL_USER}>`,
      to: recipient,
      subject: `${testOtp} — SmartBuild Nodemailer Test`,
      html: `
        <div style="font-family: sans-serif; padding: 20px; border: 1px solid #ccc; border-radius: 8px;">
          <h2 style="color: #1e3a5f;">SmartBuild Email Service Test</h2>
          <p>Nodemailer & Gmail SMTP integration is working successfully!</p>
          <p>Test OTP Code: <strong style="font-size: 24px; color: #1e3a5f;">${testOtp}</strong></p>
        </div>
      `,
    });

    console.log(`✅ Test email sent successfully to ${recipient}!`);
    console.log(`Message ID: ${info.messageId}`);
    console.log('\n🎉 All tests passed successfully!');
  } catch (error) {
    console.error('❌ Failed to send test email:', error);
    process.exit(1);
  }
}

testEmail();
