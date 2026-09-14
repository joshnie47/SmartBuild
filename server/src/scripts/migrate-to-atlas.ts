/**
 * migrate-to-atlas.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Migrates all data from a local MongoDB instance to MongoDB Atlas.
 *
 * Source : mongodb://127.0.0.1:27017/smartbuild
 * Target : mongodb+srv://smartbuild:SmartBuild123@m0.ikndcrn.mongodb.net/...
 *
 * Usage:
 *   npx ts-node src/scripts/migrate-to-atlas.ts
 *
 * Safe to re-run: uses insertMany with ordered:false so duplicate _id errors
 * are silently skipped — already-migrated documents won't be duplicated.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import mongoose from 'mongoose';
import dns from 'dns';

// Force Google DNS so Atlas SRV records resolve correctly
dns.setServers(['8.8.8.8', '8.8.4.4']);

// ── Config ────────────────────────────────────────────────────────────────────
const LOCAL_URI  = 'mongodb://127.0.0.1:27017/smartbuild';
const ATLAS_URI  = 'mongodb+srv://joshnie:25mx320@m0.ikndcrn.mongodb.net/?retryWrites=true&w=majority&appName=M0';
const DB_NAME    = 'smartbuild';

const COLLECTIONS = [
  'users',
  'contractorprofiles',
  'projects',
  'bids',
  'reviews',
  'notifications',
  'otps',
];

// ── Helpers ────────────────────────────────────────────────────────────────────
function log(msg: string) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

function pad(s: string | number, n = 22) {
  return String(s).padEnd(n);
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function migrate() {
  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║   SmartBuild — Local → Atlas Migration Script        ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');

  // ── 1. Connect to LOCAL MongoDB ──────────────────────────────────────────
  log('Connecting to LOCAL MongoDB (127.0.0.1:27017)…');
  const localConn = await mongoose.createConnection(LOCAL_URI).asPromise();
  log(`✅ Connected to local: ${localConn.host}`);

  // ── 2. Connect to ATLAS ──────────────────────────────────────────────────
  log('Connecting to MongoDB ATLAS…');
  const atlasConn = await mongoose.createConnection(ATLAS_URI, {
    dbName: DB_NAME,
  }).asPromise();
  log(`✅ Connected to Atlas: ${atlasConn.host}\n`);

  const localDb  = localConn.db!;
  const atlasDb  = atlasConn.db!;

  // Summary table header
  console.log('┌────────────────────────┬────────────┬────────────┬────────────┐');
  console.log('│ Collection             │ Source Docs│  Migrated  │  Skipped   │');
  console.log('├────────────────────────┼────────────┼────────────┼────────────┤');

  let totalMigrated = 0;
  let totalSkipped  = 0;

  for (const collName of COLLECTIONS) {
    // ── Read all documents from local ───────────────────────────────────────
    const localColl = localDb.collection(collName);
    const docs = await localColl.find({}).toArray();
    const sourceCount = docs.length;

    if (sourceCount === 0) {
      // Ensure the collection exists on Atlas even if empty
      const atlasColl = atlasDb.collection(collName);
      const atlasExists = await atlasDb.listCollections({ name: collName }).toArray();
      if (atlasExists.length === 0) {
        await atlasDb.createCollection(collName);
      }
      console.log(`│ ${pad(collName)}│ ${pad(sourceCount, 10)}│ ${pad(0, 10)}│ ${pad(0, 10)}│`);
      continue;
    }

    // ── Batch insert into Atlas (skip duplicates) ────────────────────────────
    const atlasColl = atlasDb.collection(collName);
    let migrated = 0;
    let skipped  = 0;

    const BATCH_SIZE = 500;
    for (let i = 0; i < docs.length; i += BATCH_SIZE) {
      const batch = docs.slice(i, i + BATCH_SIZE);
      try {
        const result = await atlasColl.insertMany(batch, { ordered: false });
        migrated += result.insertedCount;
      } catch (err: any) {
        // ordered:false means it inserts what it can and returns a BulkWriteError
        // for duplicates (E11000). We parse the inserted count from the error.
        if (err.code === 11000 || err.name === 'MongoBulkWriteError') {
          const inserted = err.result?.insertedCount ?? err.insertedCount ?? 0;
          migrated += inserted;
          skipped  += batch.length - inserted;
        } else {
          throw err; // unexpected error — re-throw
        }
      }
    }

    skipped += sourceCount - migrated;
    totalMigrated += migrated;
    totalSkipped  += skipped;

    console.log(`│ ${pad(collName)}│ ${pad(sourceCount, 10)}│ ${pad(migrated, 10)}│ ${pad(skipped, 10)}│`);
  }

  console.log('└────────────────────────┴────────────┴────────────┴────────────┘');
  console.log(`\n  Total migrated : ${totalMigrated}`);
  console.log(`  Total skipped  : ${totalSkipped} (already existed in Atlas)`);

  // ── 3. Close connections ─────────────────────────────────────────────────
  await localConn.close();
  await atlasConn.close();

  console.log('\n✅ Migration complete. All connections closed.\n');
}

migrate().catch((err) => {
  console.error('\n❌ Migration FAILED:', err.message || err);
  process.exit(1);
});
