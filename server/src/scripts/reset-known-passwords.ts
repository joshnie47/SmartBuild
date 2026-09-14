/**
 * reset-known-passwords.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Resets passwords and PINs for known test accounts to known working values.
 * Run: npx ts-node --transpile-only src/scripts/reset-known-passwords.ts
 * ─────────────────────────────────────────────────────────────────────────────
 */
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dns from 'dns';
dns.setServers(['8.8.8.8', '8.8.4.4']);

const ATLAS_URI = 'mongodb+srv://joshnie:25mx320@m0.ikndcrn.mongodb.net/?retryWrites=true&w=majority&appName=M0';

// Accounts to reset — adjust passwords/PINs as needed
const EMAIL_RESETS = [
  { email: '25mx320@psgtech.ac.in',   newPassword: 'Joshnie@123' },
  { email: '25mx351@psgtech.ac.in',   newPassword: 'Suriya@123'  },
];

const PHONE_PIN_RESETS = [
  { phone: '+918838902506', newPin: '111111' }, // Mohana
  { phone: '+919842227536', newPin: '111111' }, // priya
  // seed contractors (originally had $2a$10$ — salt 10, probably 123456)
  { phone: '+919876500001', newPin: '123456' }, // Arun Kumar
  { phone: '+919876500002', newPin: '123456' }, // Ravi Chandran
  { phone: '+919876500003', newPin: '123456' }, // Suresh Mani
  { phone: '+919876500004', newPin: '123456' }, // Karthik Raja
  { phone: '+919876500005', newPin: '123456' }, // Mani Velu
  { phone: '+919876501001', newPin: '123456' }, // Arjun Mehta
  { phone: '+919842327537', newPin: '111111' }, // Vishnu
  { phone: '+919876599991', newPin: '123456' }, // Vikram Construction Works
  { phone: '+919876599992', newPin: '123456' }, // Balaji Electricals
  { phone: '+919876588881', newPin: '123456' }, // Skyline Civil
  { phone: '+919876588882', newPin: '123456' }, // Apex Electrical
  { phone: '+919876514162', newPin: '123456' }, // Vikram Construction Works 2
];

// abishek has no pin and no password — give him a PIN so he can log in
const MISSING_PIN_SETUP = [
  { phone: '+919894960929', newPin: '111111' }, // abishek
];

async function run() {
  console.log('\n🔑 Resetting known credentials in Atlas...\n');

  const conn = await mongoose.createConnection(ATLAS_URI, { dbName: 'smartbuild' }).asPromise();
  const users = conn.db!.collection('users');

  let updated = 0;

  // ── Email/Password resets ─────────────────────────────────────────────────
  for (const { email, newPassword } of EMAIL_RESETS) {
    const hash = await bcrypt.hash(newPassword, 12);
    const result = await users.updateOne(
      { email },
      { $set: { password: hash } }
    );
    if (result.modifiedCount > 0) {
      console.log(`✅ Password reset for ${email} → ${newPassword}`);
      updated++;
    } else {
      console.log(`⚠️  No user found with email: ${email}`);
    }
  }

  // ── Phone/PIN resets ──────────────────────────────────────────────────────
  for (const { phone, newPin } of [...PHONE_PIN_RESETS, ...MISSING_PIN_SETUP]) {
    const hash = await bcrypt.hash(newPin, 12);
    const result = await users.updateOne(
      { phone },
      { $set: { pinHash: hash } }
    );
    if (result.modifiedCount > 0) {
      console.log(`✅ PIN reset for ${phone} → ${newPin}`);
      updated++;
    } else {
      console.log(`⚠️  No user found with phone: ${phone}`);
    }
  }

  console.log(`\n✅ Done. ${updated} accounts updated.\n`);
  console.log('─'.repeat(50));
  console.log('📋 Login Reference Card');
  console.log('─'.repeat(50));
  console.log('\n📧 Email Accounts:');
  console.log('  Joshnie  (CLIENT)     : 25mx320@psgtech.ac.in  / Joshnie@123');
  console.log('  Suriya   (CONTRACTOR) : 25mx351@psgtech.ac.in  / Suriya@123');
  console.log('\n📱 Phone + PIN Accounts (PIN = 123456):');
  console.log('  Arun Kumar     +919876500001');
  console.log('  Ravi Chandran  +919876500002');
  console.log('  Suresh Mani    +919876500003');
  console.log('  Karthik Raja   +919876500004');
  console.log('  Mani Velu      +919876500005');
  console.log('  Arjun Mehta    +919876501001');
  console.log('  Vikram Const.  +919876599991 / +919876514162');
  console.log('  Balaji Elec.   +919876599992');
  console.log('  Skyline Civil  +919876588881');
  console.log('  Apex Elec.     +919876588882');
  console.log('\n📱 Phone + PIN Accounts (PIN = 111111):');
  console.log('  Mohana   +918838902506');
  console.log('  priya    +919842227536');
  console.log('  Vishnu   +919842327537');
  console.log('  abishek  +919894960929');
  console.log('─'.repeat(50));

  await conn.close();
}

run().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
