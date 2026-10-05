import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { User } from '../models/User';
import { Project } from '../models/Project';
import { Bid } from '../models/Bid';
import { Notification } from '../models/Notification';
import { createConversationOnBidAccept } from '../services/chat/conversation.service';
import { createMessage } from '../services/chat/message.service';

dotenv.config({ path: path.join(__dirname, '../../.env') });

async function runTest() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/smartbuild';
  console.log('Connecting to MongoDB...');
  await mongoose.connect(mongoUri);

  try {
    // 1. Find or create Client Mohana and Contractor Vishnu
    let mohana = await User.findOne({ fullName: 'Mohana' });
    if (!mohana) {
      mohana = await User.create({
        fullName: 'Mohana',
        phone: '+919998887771',
        role: 'CLIENT',
        status: 'ACTIVE',
      });
    }

    let vishnu = await User.findOne({ fullName: 'Vishnu' });
    if (!vishnu) {
      vishnu = await User.create({
        fullName: 'Vishnu',
        phone: '+919998887772',
        role: 'CONTRACTOR',
        status: 'ACTIVE',
      });
    }

    // 2. Find or create a dummy project and bid
    let project = await Project.findOne({ clientId: mohana._id });
    if (!project) {
      project = await Project.create({
        title: 'Foundation Repair Project',
        description: 'Test foundation repair',
        clientId: mohana._id,
        category: 'FOUNDATION',
        location: 'Chennai',
        budget: 50000,
        timeline: '1 month',
        status: 'OPEN',
      });
    }

    let bid = await Bid.findOne({ projectId: project._id, contractorId: vishnu._id });
    if (!bid) {
      bid = await Bid.create({
        projectId: project._id,
        contractorId: vishnu._id,
        amount: 48000,
        timeline: '25 days',
        estimatedDays: 25,
        proposal: 'Will complete foundation work',
        status: 'ACCEPTED',
      });
    }

    // 3. Create or get conversation
    const conversation = await createConversationOnBidAccept(
      project._id.toString(),
      bid._id.toString(),
      mohana._id.toString(),
      vishnu._id.toString()
    );

    console.log(`Conversation ID: ${conversation._id}`);

    // --- TEST DIRECTION 1: Mohana -> Vishnu ---
    const msgId1 = `test-msg-1-${Date.now()}`;
    console.log('Sending message: Mohana -> Vishnu');
    await createMessage({
      conversationId: conversation._id.toString(),
      senderId: mohana._id.toString(),
      clientMessageId: msgId1,
      body: 'Please provide an update on the foundation work.',
    });

    // Verify Vishnu's notification
    const vishnuNotif = await Notification.findOne({
      recipientId: vishnu._id,
      type: 'CHAT_MESSAGE',
    }).sort({ createdAt: -1 });

    console.log(`\nVishnu Received Notification:`);
    console.log(`- Recipient ID: ${vishnuNotif?.recipientId} (Vishnu)`);
    console.log(`- Sender ID: ${vishnuNotif?.senderId} (Mohana: ${mohana._id})`);
    console.log(`- Title: "${vishnuNotif?.title}"`);
    console.log(`- Message: "${vishnuNotif?.message}"`);

    if (vishnuNotif?.title === 'New message from Mohana') {
      console.log('SUCCESS: Notification title correctly identifies sender as Mohana!');
    } else {
      console.error(`FAILED: Expected "New message from Mohana", got "${vishnuNotif?.title}"`);
    }

    // --- TEST DIRECTION 2: Vishnu -> Mohana ---
    const msgId2 = `test-msg-2-${Date.now()}`;
    console.log('\nSending message: Vishnu -> Mohana');
    await createMessage({
      conversationId: conversation._id.toString(),
      senderId: vishnu._id.toString(),
      clientMessageId: msgId2,
      body: 'Foundation excavation is completed. Concrete pouring starts tomorrow.',
    });

    // Verify Mohana's notification
    const mohanaNotif = await Notification.findOne({
      recipientId: mohana._id,
      type: 'CHAT_MESSAGE',
    }).sort({ createdAt: -1 });

    console.log(`\nMohana Received Notification:`);
    console.log(`- Recipient ID: ${mohanaNotif?.recipientId} (Mohana)`);
    console.log(`- Sender ID: ${mohanaNotif?.senderId} (Vishnu: ${vishnu._id})`);
    console.log(`- Title: "${mohanaNotif?.title}"`);
    console.log(`- Message: "${mohanaNotif?.message}"`);

    if (mohanaNotif?.title === 'New message from Vishnu') {
      console.log('SUCCESS: Notification title correctly identifies sender as Vishnu!');
    } else {
      console.error(`FAILED: Expected "New message from Vishnu", got "${mohanaNotif?.title}"`);
    }

  } catch (err) {
    console.error('Error in test:', err);
  } finally {
    await mongoose.disconnect();
    console.log('Done.');
  }
}

runTest();
