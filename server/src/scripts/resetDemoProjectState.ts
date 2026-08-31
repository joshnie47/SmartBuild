import mongoose from 'mongoose';
import { Project } from '../models/Project';
import { Bid } from '../models/Bid';

async function reset() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/smartbuild');
  await Project.updateOne(
    { title: 'Residential Construction' },
    { $set: { status: 'OPEN', selectedBidId: null, selectedContractorId: null } }
  );
  await Bid.updateOne(
    { amount: 2250000 },
    { $set: { status: 'SUBMITTED' } }
  );
  console.log('✅ "Residential Construction" project set to OPEN with Vishnu bid SUBMITTED.');
  await mongoose.disconnect();
}

reset().catch(console.error);
