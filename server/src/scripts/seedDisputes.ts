import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { connectDB } from '../config/db';
import { User } from '../models/User';
import { Project } from '../models/Project';
import { Dispute } from '../models/Dispute';

async function seedDisputes() {
  try {
    await connectDB();
    console.log('Connected to DB for seeding disputes...');

    // Find a client user
    let client = await User.findOne({ role: 'CLIENT' });
    if (!client) {
      console.log('No client user found. Creating a default client...');
      client = await User.create({
        fullName: 'Anand Kumar',
        email: 'anand.client@example.com',
        password: 'password123',
        role: 'CLIENT',
        isVerified: true,
      });
    }

    // Find a contractor user
    let contractor = await User.findOne({ role: 'CONTRACTOR' });
    if (!contractor) {
      console.log('No contractor user found. Creating a default contractor...');
      contractor = await User.create({
        fullName: 'Rahul',
        email: 'rahul.contractor@example.com',
        password: 'password123',
        role: 'CONTRACTOR',
        isVerified: true,
        kycStatus: 'VERIFIED',
      });
    }

    // Find or create a project with contractor assigned
    let project = await Project.findOne({ selectedContractorId: { $ne: null } });
    if (!project) {
      project = await Project.findOne({});
    }

    if (!project) {
      console.log('No project found. Creating a sample project...');
      project = await Project.create({
        title: 'Modern 3BHK Villa Construction',
        description: 'Construction of 3BHK villa in Saravanampatti with premium materials.',
        category: 'Residential Construction',
        budget: 4500000,
        timeline: '8 Months',
        location: 'Coimbatore',
        clientId: client._id,
        selectedContractorId: contractor._id,
        status: 'IN_PROGRESS',
        imageUrls: ['https://images.pexels.com/photos/5828395/pexels-photo-5828395.jpeg'],
      });
    } else if (!project.selectedContractorId) {
      project.selectedContractorId = contractor._id as any;
      await project.save();
    }

    // Clear any existing dummy disputes to start fresh for demo recording
    const existingDisputeCount = await Dispute.countDocuments();
    if (existingDisputeCount > 0) {
      console.log(`Found ${existingDisputeCount} existing dispute(s). Resetting for exact seed demonstration...`);
      await Dispute.deleteMany({});
    }

    // Dispute 1 — Client vs Contractor: Incomplete Milestone (Initial Status: OPEN)
    const dispute1 = await Dispute.create({
      projectId: project._id,
      clientId: client._id,
      contractorId: project.selectedContractorId,
      raisedBy: client._id,
      title: 'Incomplete work despite milestone marked as completed',
      issueCategory: 'Milestone / Work Completion',
      description: 'The contractor marked the second milestone as completed, but part of the agreed work is still incomplete. The client has reviewed the completed work and found that the remaining construction work has not been finished as specified in the project agreement. The client has submitted the available project evidence and requested Admin intervention.',
      evidenceUrls: [
        'https://images.pexels.com/photos/1216589/pexels-photo-1216589.jpeg',
        'https://images.pexels.com/photos/8961065/pexels-photo-8961065.jpeg'
      ],
      status: 'OPEN',
      priority: 'High',
    });

    // Dispute 2 — Contractor vs Client: Payment Issue (Initial Status: OPEN)
    const dispute2 = await Dispute.create({
      projectId: project._id,
      clientId: client._id,
      contractorId: project.selectedContractorId,
      raisedBy: project.selectedContractorId,
      title: 'Milestone payment not released after completion',
      issueCategory: 'Payment / Milestone',
      description: 'The contractor has reported that the payment associated with a completed milestone has not been released. The contractor states that the agreed milestone work has been completed and has provided the available project completion evidence. The contractor has requested Admin verification and resolution of the payment issue.',
      evidenceUrls: [
        'https://images.pexels.com/photos/5828395/pexels-photo-5828395.jpeg'
      ],
      status: 'OPEN',
      priority: 'Medium',
    });

    console.log('✅ Demo disputes seeded successfully:');
    console.log('Dispute 1 (OPEN - Client):', dispute1._id.toString(), dispute1.title);
    console.log('Dispute 2 (OPEN - Contractor):', dispute2._id.toString(), dispute2.title);

    process.exit(0);
  } catch (err) {
    console.error('Error seeding disputes:', err);
    process.exit(1);
  }
}

seedDisputes();
