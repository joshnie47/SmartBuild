/**
 * diagnose-auth.ts
 * Checks users in Atlas — shows their auth fields without exposing sensitive data.
 * Run: npx ts-node --transpile-only src/scripts/diagnose-auth.ts
 */
import mongoose from 'mongoose';
import dns from 'dns';
dns.setServers(['8.8.8.8', '8.8.4.4']);

const ATLAS_URI = 'mongodb+srv://joshnie:25mx320@m0.ikndcrn.mongodb.net/?retryWrites=true&w=majority&appName=M0';

async function diagnose() {
  console.log('\n🔍 Diagnosing Atlas users...\n');

  const conn = await mongoose.createConnection(ATLAS_URI, { dbName: 'smartbuild' }).asPromise();
  const db = conn.db!;

  const users = await db.collection('users').find({}).toArray();

  console.log(`Total users in Atlas: ${users.length}\n`);
  console.log('─'.repeat(80));

  for (const u of users) {
    console.log(`Name    : ${u.fullName}`);
    console.log(`Role    : ${u.role}`);
    console.log(`Phone   : ${u.phone || '(none)'}`);
    console.log(`Email   : ${u.email || '(none)'}`);
    console.log(`Has pinHash  : ${!!u.pinHash}  ${u.pinHash ? '→ starts with ' + u.pinHash.substring(0, 7) : ''}`);
    console.log(`Has password : ${!!u.password}  ${u.password ? '→ starts with ' + u.password.substring(0, 7) : ''}`);
    console.log(`Status  : ${u.status || 'ACTIVE'}`);
    console.log('─'.repeat(80));
  }

  await conn.close();
}

diagnose().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
