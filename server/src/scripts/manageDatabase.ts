import mongoose from 'mongoose';
import { User } from '../models/User';
import { ContractorProfile } from '../models/ContractorProfile';
import { Project } from '../models/Project';
import { Bid } from '../models/Bid';
import { Review } from '../models/Review';
import { Notification } from '../models/Notification';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/smartbuild';

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'list';

  await mongoose.connect(MONGODB_URI);
  console.log(`Connected to SmartBuild MongoDB Database: ${MONGODB_URI}\n`);

  try {
    switch (command) {
      case 'list': {
        const users = await User.find({});
        const projects = await Project.find({}).populate('clientId', 'fullName role phone');
        const bids = await Bid.find({}).populate('projectId', 'title').populate('contractorId', 'fullName');

        console.log('========================================================');
        console.log(`ALL USERS (${users.length}):`);
        console.log('========================================================');
        users.forEach((u, i) => {
          console.log(`${i + 1}. [${u.role}] ${u.fullName} (ID: ${u._id}) | Phone: ${u.phone || 'N/A'} | Status: ${u.status || 'ACTIVE'}`);
        });

        console.log('\n========================================================');
        console.log(`ALL PROJECTS (${projects.length}):`);
        console.log('========================================================');
        projects.forEach((p, i) => {
          const client = p.clientId as any;
          console.log(`${i + 1}. "${p.title}" (ID: ${p._id})`);
          console.log(`   Client: ${client?.fullName} (Phone: ${client?.phone})`);
          console.log(`   Location: ${p.location} | Budget: ₹${p.budget?.toLocaleString('en-IN')} | Status: ${p.status}`);
        });

        console.log('\n========================================================');
        console.log(`ALL BIDS (${bids.length}):`);
        console.log('========================================================');
        bids.forEach((b, i) => {
          const p = b.projectId as any;
          const c = b.contractorId as any;
          console.log(`${i + 1}. Bid ID: ${b._id} | Contractor: ${c?.fullName} | Project: "${p?.title}" | Amount: ₹${b.amount?.toLocaleString('en-IN')} | Status: ${b.status}`);
        });
        break;
      }

      case 'delete-contractor': {
        const target = args[1];
        if (!target) {
          console.error('Error: Please provide contractor ID or phone number:');
          console.log('Usage: npx ts-node src/scripts/manageDatabase.ts delete-contractor <contractorId_or_phone>');
          process.exit(1);
        }

        const user = mongoose.Types.ObjectId.isValid(target)
          ? await User.findById(target)
          : await User.findOne({ phone: target }) || await User.findOne({ fullName: target });

        if (!user) {
          console.error(`Contractor matching "${target}" not found in database.`);
          process.exit(1);
        }

        const contractorId = user._id;
        console.log(`Deleting contractor "${user.fullName}" (ID: ${contractorId})...`);

        await Promise.all([
          User.findByIdAndDelete(contractorId),
          ContractorProfile.deleteMany({ userId: contractorId }),
          Bid.deleteMany({ contractorId }),
          Review.deleteMany({ contractorId }),
          Notification.deleteMany({ $or: [{ recipientId: contractorId }, { senderId: contractorId }] }),
          Project.updateMany({ selectedContractorId: contractorId }, { $unset: { selectedContractorId: 1, selectedBidId: 1 }, $set: { status: 'OPEN' } }),
        ]);

        console.log(`✅ Successfully deleted contractor "${user.fullName}" and all associated bids/profile data.`);
        break;
      }

      case 'delete-project': {
        const target = args[1];
        if (!target) {
          console.error('Error: Please provide project ID:');
          console.log('Usage: npx ts-node src/scripts/manageDatabase.ts delete-project <projectId>');
          process.exit(1);
        }

        const project = await Project.findById(target);
        if (!project) {
          console.error(`Project matching ID "${target}" not found.`);
          process.exit(1);
        }

        console.log(`Deleting project "${project.title}" (ID: ${project._id})...`);
        await Promise.all([
          Project.findByIdAndDelete(target),
          Bid.deleteMany({ projectId: target }),
          Notification.deleteMany({ projectId: target }),
        ]);

        console.log(`✅ Successfully deleted project "${project.title}" and its bids.`);
        break;
      }

      default: {
        console.log('SmartBuild Database Manager CLI');
        console.log('Commands:');
        console.log('  npx ts-node src/scripts/manageDatabase.ts list');
        console.log('  npx ts-node src/scripts/manageDatabase.ts delete-contractor <id_or_phone>');
        console.log('  npx ts-node src/scripts/manageDatabase.ts delete-project <projectId>');
        break;
      }
    }
  } finally {
    await mongoose.disconnect();
  }
}

main().catch(console.error);
