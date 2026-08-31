import mongoose from 'mongoose';
import { Project } from '../models/Project';
import { User } from '../models/User';
import { Bid } from '../models/Bid';
import { Notification } from '../models/Notification';

async function finalPrune() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/smartbuild');

  // Keep only 1 completed office renovation project
  const toDelete = [
    new mongoose.Types.ObjectId('6a95910a56f467dac0fb7129'),
    new mongoose.Types.ObjectId('6a95949732ed21e1374d8f9b'),
    new mongoose.Types.ObjectId('6a954888a711408c19424163'), // older test client project poster
  ];

  await Project.deleteMany({ _id: { $in: toDelete } });
  await Bid.deleteMany({ projectId: { $in: toDelete } });

  const remaining = await Project.find({}).populate('clientId', 'fullName phone role');
  console.log(`\n========================================================`);
  console.log(`FINAL DEMO READY PROJECTS IN MONGODB (${remaining.length}):`);
  console.log(`========================================================`);
  for (const p of remaining) {
    const bidsCount = await Bid.countDocuments({ projectId: p._id });
    const client = p.clientId as any;
    console.log(`- Project: "${p.title}"`);
    console.log(`  _id: ${p._id}`);
    console.log(`  Posted by: ${client?.fullName} (${client?.phone})`);
    console.log(`  Location: ${p.location}`);
    console.log(`  Budget: ₹${p.budget?.toLocaleString('en-IN')}`);
    console.log(`  Status: ${p.status}`);
    console.log(`  Bids Count: ${bidsCount}`);
    console.log(`--------------------------------------------------------`);
  }

  const vishnu = await User.findOne({ phone: '+919842327537' }) || await User.findOne({ phone: '9842327537' }) || await User.findOne({ fullName: 'Vishnu' });
  if (vishnu) {
    const vishnuBids = await Bid.find({ contractorId: vishnu._id }).populate('projectId');
    console.log(`\nVISHNU BIDS IN DB (${vishnuBids.length}):`);
    for (const b of vishnuBids) {
      const proj = b.projectId as any;
      console.log(`- Bid ID: ${b._id}`);
      console.log(`  Project: "${proj?.title}" in ${proj?.location}`);
      console.log(`  Amount: ₹${b.amount?.toLocaleString('en-IN')}`);
      console.log(`  Status: ${b.status}`);
      console.log(`  Proposal: "${b.proposalMessage}"`);
    }
  }

  await mongoose.disconnect();
}

finalPrune().catch(console.error);
