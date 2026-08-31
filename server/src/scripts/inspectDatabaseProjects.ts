import mongoose from 'mongoose';
import { Project } from '../models/Project';
import { User } from '../models/User';
import { Bid } from '../models/Bid';
import { ContractorProfile } from '../models/ContractorProfile';

async function inspectDb() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/smartbuild');
  console.log('MongoDB connected successfully.\n');

  const users = await User.find({});
  const userMap = new Map();
  users.forEach((u) => userMap.set(u._id.toString(), u));

  console.log(`=== USERS IN MONGODB (${users.length}) ===`);
  users.forEach((u, idx) => {
    console.log(
      `${idx + 1}. [${u.role}] ${u.fullName} (Phone: ${u.phone || 'None'}, Email: ${u.email || 'None'}, ID: ${u._id})`
    );
  });

  const projects = await Project.find({}).sort({ createdAt: 1 });
  console.log(`\n=== PROJECTS IN MONGODB (${projects.length}) ===`);

  const validProjects: any[] = [];
  const testScriptProjects: any[] = [];

  projects.forEach((p, idx) => {
    const client = p.clientId ? userMap.get(p.clientId.toString()) : null;
    const isValid = client && client.role === 'CLIENT';
    const isTestAditi = client && client.fullName?.includes('Aditi Sharma');
    const isDuplicateRun = p.title.includes('Residential Villa Construction') || p.title.includes('Luxury 3BHK');

    console.log(`\n${idx + 1}. [${isValid ? 'VALID CLIENT PROJECT' : 'INVALID'}] "${p.title}"`);
    console.log(`   _id: ${p._id}`);
    console.log(`   clientId: ${p.clientId} (${client ? client.fullName : 'MISSING USER'})`);
    console.log(`   clientRole: ${client ? client.role : 'N/A'}`);
    console.log(`   status: ${p.status}`);
    console.log(`   location: ${p.location}`);
    console.log(`   budget: ₹${p.budget?.toLocaleString('en-IN')}`);
    console.log(`   createdAt: ${p.createdAt?.toISOString()}`);

    if (isValid) {
      validProjects.push(p);
    }
  });

  console.log(`\n=== VISHNU CONTRACTOR ACCOUNT & BIDS ===`);
  const vishnuUser = await User.findOne({ phone: '+919842327537' }) || await User.findOne({ phone: '9842327537' }) || await User.findOne({ fullName: 'Vishnu' });
  if (vishnuUser) {
    console.log(`Vishnu User ID: ${vishnuUser._id}, Role: ${vishnuUser.role}, Name: ${vishnuUser.fullName}`);
    const vishnuBids = await Bid.find({ contractorId: vishnuUser._id }).populate('projectId');
    console.log(`Total Bids submitted by Vishnu: ${vishnuBids.length}`);
    vishnuBids.forEach((b, idx) => {
      const proj = b.projectId as any;
      const client = proj?.clientId ? userMap.get(proj.clientId.toString()) : null;
      console.log(`  Bid #${idx + 1}:`);
      console.log(`    _id: ${b._id}`);
      console.log(`    projectId: ${proj?._id} ("${proj?.title}")`);
      console.log(`    projectStatus: ${proj?.status}`);
      console.log(`    postedBy: ${client ? client.fullName : 'UNKNOWN CLIENT'} (${client?._id})`);
      console.log(`    amount: ₹${b.amount?.toLocaleString('en-IN')}`);
      console.log(`    status: ${b.status}`);
      console.log(`    createdAt: ${b.createdAt?.toISOString()}`);
    });
  } else {
    console.log('Vishnu user not found.');
  }

  await mongoose.disconnect();
}

inspectDb().catch((e) => {
  console.error(e);
  process.exit(1);
});
