/**
 * migrateToAtlas.ts
 * -----------------
 * Migrates all SmartBuild collections from local MongoDB
 * to MongoDB Atlas, preserving all ObjectIds and documents.
 *
 * Run with:
 *   npx ts-node src/scripts/migrateToAtlas.ts
 */

import { MongoClient, Db, Document } from 'mongodb';
import dns from 'dns';

// Force Google DNS so Atlas SRV record resolves correctly
dns.setServers(['8.8.8.8', '8.8.4.4']);

// ─── Config ────────────────────────────────────────────────────────────────
const LOCAL_URI  = 'mongodb://127.0.0.1:27017';
const ATLAS_URI  = 'mongodb+srv://joshnie:25mx320@m0.ikndcrn.mongodb.net/?retryWrites=true&w=majority&appName=M0';
const DB_NAME    = 'smartbuild';
const BATCH_SIZE = 500; // documents per insert batch

const COLLECTIONS = [
  'bids',
  'contractorprofiles',
  'notifications',
  'otps',
  'projects',
  'reviews',
  'users',
];

// ─── Helpers ───────────────────────────────────────────────────────────────
function log(msg: string) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

async function migrateCollection(
  sourceDb: Db,
  destDb: Db,
  collectionName: string
): Promise<number> {
  log(`\n▶  Migrating: ${collectionName}`);

  const sourceCol = sourceDb.collection(collectionName);
  const destCol   = destDb.collection(collectionName);

  // Fetch all documents from source
  const docs: Document[] = await sourceCol.find({}).toArray();
  const total = docs.length;

  if (total === 0) {
    // Create collection on Atlas even if empty
    await destDb.createCollection(collectionName).catch(() => {
      // Collection may already exist — safe to ignore
    });
    log(`   ⚠  Empty collection — created on Atlas with 0 documents`);
    return 0;
  }

  // Split into batches and insert
  let migrated = 0;
  for (let i = 0; i < total; i += BATCH_SIZE) {
    const batch = docs.slice(i, i + BATCH_SIZE);
    await destCol.insertMany(batch, { ordered: false }).catch((err: any) => {
      // E11000 = duplicate key — document already exists on Atlas, skip it
      if (err.code === 11000) {
        const dupes = err.result?.nInserted ?? batch.length;
        log(`   ⚠  Some docs already existed on Atlas (skipped duplicates)`);
        migrated += dupes;
        return;
      }
      throw err;
    });
    migrated += batch.length;
    log(`   ✔  ${migrated} / ${total} documents inserted`);
  }

  log(`   ✅ ${collectionName}: ${migrated} document(s) migrated successfully`);
  return migrated;
}

// ─── Main ──────────────────────────────────────────────────────────────────
async function main() {
  log('═══════════════════════════════════════════════════');
  log(' SmartBuild — Local → Atlas Migration');
  log('═══════════════════════════════════════════════════');

  const localClient = new MongoClient(LOCAL_URI);
  const atlasClient = new MongoClient(ATLAS_URI);

  try {
    log('\n🔌 Connecting to Local MongoDB...');
    await localClient.connect();
    log('   ✅ Local MongoDB connected');

    log('🔌 Connecting to MongoDB Atlas...');
    await atlasClient.connect();
    log('   ✅ Atlas connected');

    const sourceDb = localClient.db(DB_NAME);
    const destDb   = atlasClient.db(DB_NAME);

    // Migrate each collection
    const results: { collection: string; count: number }[] = [];
    for (const col of COLLECTIONS) {
      const count = await migrateCollection(sourceDb, destDb, col);
      results.push({ collection: col, count });
    }

    // ─── Summary ─────────────────────────────────────────────────────
    log('\n═══════════════════════════════════════════════════');
    log(' Migration Summary');
    log('═══════════════════════════════════════════════════');
    let grandTotal = 0;
    for (const r of results) {
      log(`   ${r.collection.padEnd(22)} → ${r.count} docs`);
      grandTotal += r.count;
    }
    log('───────────────────────────────────────────────────');
    log(`   TOTAL                    → ${grandTotal} docs`);
    log('═══════════════════════════════════════════════════');
    log('\n🎉 Migration complete! Your data is now on Atlas.\n');

  } catch (err) {
    log(`\n❌ Migration failed: ${(err as Error).message}`);
    console.error(err);
    process.exit(1);
  } finally {
    await localClient.close();
    await atlasClient.close();
    log('🔒 Both connections closed.');
  }
}

main();
