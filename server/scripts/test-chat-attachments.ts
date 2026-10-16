import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

import dns from 'dns';
try {
  dns.setDefaultResultOrder('ipv4first');
  dns.setServers(['8.8.8.8', '8.8.4.4']);
} catch {
  // ignore
}

dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { User } from '../src/models/User';
import { Project } from '../src/models/Project';
import { Bid } from '../src/models/Bid';
import { Conversation } from '../src/models/Conversation';
import { Message } from '../src/models/Message';
import { Notification } from '../src/models/Notification';
import {
  getChatGridFSBucket,
  uploadToGridFS,
  deleteFromGridFS,
  getFileFromGridFS,
  openDownloadStreamFromGridFS,
  validateAttachment,
} from '../src/config/gridfs';
import { createMessage, getMessages } from '../src/services/chat/message.service';

async function runTests() {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGO_URI is not set in server/.env');
    process.exit(1);
  }

  console.log('Connecting to MongoDB Atlas...');
  await mongoose.connect(uri);
  console.log('✅ Connected to MongoDB Atlas:', mongoose.connection.name);

  try {
    // ── Setup test users and conversation ──
    const contractor = await User.findOneAndUpdate(
      { email: 'test_contractor_attach@smartbuild.test' },
      {
        fullName: 'Test Contractor',
        email: 'test_contractor_attach@smartbuild.test',
        phone: '+919999990001',
        role: 'CONTRACTOR',
      },
      { upsert: true, new: true }
    );

    const client = await User.findOneAndUpdate(
      { email: 'test_client_attach@smartbuild.test' },
      {
        fullName: 'Test Client',
        email: 'test_client_attach@smartbuild.test',
        phone: '+919999990002',
        role: 'CLIENT',
      },
      { upsert: true, new: true }
    );

    const project = await Project.findOneAndUpdate(
      { title: 'Chat Attachment Test Project' },
      {
        clientId: client._id,
        title: 'Chat Attachment Test Project',
        description: 'Test project for chat attachments',
        category: 'Residential Construction',
        status: 'In Progress',
        budget: 50000,
        timeline: '1 month',
        location: 'Mumbai',
      },
      { upsert: true, new: true }
    );

    const bid = await Bid.findOneAndUpdate(
      { projectId: project._id, contractorId: contractor._id },
      {
        projectId: project._id,
        contractorId: contractor._id,
        amount: 45000,
        estimatedDays: 20,
        status: 'ACCEPTED',
      },
      { upsert: true, new: true }
    );

    let conversation = await Conversation.findOne({ projectId: project._id });
    if (!conversation) {
      conversation = await Conversation.create({
        projectId: project._id,
        bidId: bid._id,
        participants: [
          { userId: client._id, lastReadMessageId: null, joinedAt: new Date() },
          { userId: contractor._id, lastReadMessageId: null, joinedAt: new Date() },
        ],
        lastMessage: null,
      });
    }

    const convId = conversation._id.toString();
    console.log(`✅ Test Conversation ready: ${convId}`);

    // ── Test D1: Validation of unsupported file types ──
    console.log('\n--- Test D1: Validation: Unsupported File Format ---');
    const badFile = validateAttachment('malicious.exe', 'application/x-msdownload', 1024);
    if (!badFile.valid) {
      console.log('✅ Unsupported file correctly rejected:', badFile.error);
    } else {
      throw new Error('FAILED: Unsupported file was accepted!');
    }

    // ── Test D2: Validation: File exceeding 10 MB ──
    console.log('\n--- Test D2: Validation: File Exceeding 10 MB ---');
    const largeFile = validateAttachment('huge.jpg', 'image/jpeg', 11 * 1024 * 1024);
    if (!largeFile.valid) {
      console.log('✅ Oversized file correctly rejected:', largeFile.error);
    } else {
      throw new Error('FAILED: Oversized file was accepted!');
    }

    // ── Test A: Contractor to Client (Image Attachment) ──
    console.log('\n--- Test A: Contractor Uploads JPG Image to GridFS & Sends Message ---');
    const imageBuffer = Buffer.from('FakeJPEGImageBinaryContent1234567890');
    const imgValidation = validateAttachment('completed_living_room.jpg', 'image/jpeg', imageBuffer.length);
    if (!imgValidation.valid || !imgValidation.validated) throw new Error('Valid JPG was rejected');

    const imageFileId = await uploadToGridFS(
      imageBuffer,
      imgValidation.validated.safeFilename,
      imgValidation.validated.mimeType,
      {
        originalFilename: 'completed_living_room.jpg',
        mimeType: imgValidation.validated.mimeType,
        fileSize: imageBuffer.length,
        senderId: contractor._id.toString(),
        conversationId: convId,
      }
    );
    console.log('✅ Image binary stored in GridFS bucket chatAttachments. File ID:', imageFileId.toString());

    // Verify file exists in GridFS
    const gridFile = await getFileFromGridFS(imageFileId);
    if (!gridFile || gridFile.length !== imageBuffer.length) {
      throw new Error('FAILED: File metadata in GridFS does not match uploaded buffer length');
    }
    console.log('✅ Verified file in GridFS bucket:', gridFile.filename, `${gridFile.length} bytes`);

    // Create Message
    const contractorMsg = await createMessage({
      conversationId: convId,
      senderId: contractor._id.toString(),
      clientMessageId: `msg-contractor-${Date.now()}`,
      body: 'Here is the completed work on the living room ceiling.',
      messageType: 'image',
      attachment: {
        fileId: imageFileId,
        filename: imgValidation.validated.safeFilename,
        mimeType: imgValidation.validated.mimeType,
        fileSize: imageBuffer.length,
      },
    });
    console.log('✅ Image message saved to Message collection:', contractorMsg._id.toString());

    // Verify Notification for Client
    const clientNotification = await Notification.findOne({
      recipientId: client._id,
      senderId: contractor._id,
      type: 'CHAT_MESSAGE',
    }).sort({ createdAt: -1 });

    if (!clientNotification) {
      throw new Error('FAILED: Notification not found for client recipient');
    }
    console.log('✅ Client notification generated successfully:');
    console.log('   Title:', clientNotification.title);
    console.log('   Message:', clientNotification.message);
    if (!clientNotification.title.includes('image')) {
      throw new Error('FAILED: Notification title does not identify image attachment');
    }

    // ── Test B: Client to Contractor (PDF Document Attachment) ──
    console.log('\n--- Test B: Client Uploads PDF Document to GridFS & Sends Message ---');
    const pdfBuffer = Buffer.from('%PDF-1.4 FakePDFDocumentBinaryContentHere');
    const docValidation = validateAttachment('approved_blueprint.pdf', 'application/pdf', pdfBuffer.length);
    if (!docValidation.valid || !docValidation.validated) throw new Error('Valid PDF was rejected');

    const pdfFileId = await uploadToGridFS(
      pdfBuffer,
      docValidation.validated.safeFilename,
      docValidation.validated.mimeType,
      {
        originalFilename: 'approved_blueprint.pdf',
        mimeType: docValidation.validated.mimeType,
        fileSize: pdfBuffer.length,
        senderId: client._id.toString(),
        conversationId: convId,
      }
    );
    console.log('✅ PDF binary stored in GridFS bucket chatAttachments. File ID:', pdfFileId.toString());

    const clientMsg = await createMessage({
      conversationId: convId,
      senderId: client._id.toString(),
      clientMessageId: `msg-client-${Date.now()}`,
      body: 'Please find the signed blueprint attached.',
      messageType: 'document',
      attachment: {
        fileId: pdfFileId,
        filename: docValidation.validated.safeFilename,
        mimeType: docValidation.validated.mimeType,
        fileSize: pdfBuffer.length,
      },
    });
    console.log('✅ Document message saved to Message collection:', clientMsg._id.toString());

    // Verify Notification for Contractor
    const contractorNotification = await Notification.findOne({
      recipientId: contractor._id,
      senderId: client._id,
      type: 'CHAT_MESSAGE',
    }).sort({ createdAt: -1 });

    if (!contractorNotification) {
      throw new Error('FAILED: Notification not found for contractor recipient');
    }
    console.log('✅ Contractor notification generated successfully:');
    console.log('   Title:', contractorNotification.title);
    console.log('   Message:', contractorNotification.message);
    if (!contractorNotification.title.includes('document')) {
      throw new Error('FAILED: Notification title does not identify document attachment');
    }

    // ── Test C: Stream from GridFS & Verify Binary Content ──
    console.log('\n--- Test C: Binary Stream Verification from GridFS ---');
    const readStream = openDownloadStreamFromGridFS(imageFileId);
    const chunks: Buffer[] = [];
    await new Promise((resolve, reject) => {
      readStream.on('data', (c) => chunks.push(Buffer.from(c)));
      readStream.on('end', resolve);
      readStream.on('error', reject);
    });
    const downloadedBuffer = Buffer.concat(chunks);
    if (downloadedBuffer.toString() !== imageBuffer.toString()) {
      throw new Error('FAILED: Downloaded image buffer does not match uploaded buffer');
    }
    console.log('✅ Downloaded binary from GridFS exactly matches original image upload!');

    // ── Test C2: Paginated History Retrieval ──
    console.log('\n--- Test C2: Paginated History Retrieval (getMessages) ---');
    const history = await getMessages(convId, 1, 10);
    const hasImage = history.messages.some((m) => m._id.toString() === contractorMsg._id.toString());
    const hasDoc = history.messages.some((m) => m._id.toString() === clientMsg._id.toString());
    if (!hasImage || !hasDoc) {
      throw new Error('FAILED: Sent messages not found in getMessages history');
    }
    console.log(`✅ Paginated history successfully returned ${history.messages.length} messages, both attachments present.`);

    // ── Cleanup Test Records ──
    console.log('\n--- Cleaning up test records ---');
    await deleteFromGridFS(imageFileId);
    await deleteFromGridFS(pdfFileId);
    await Message.deleteMany({ conversationId: conversation._id });
    await Notification.deleteMany({
      _id: { $in: [clientNotification._id, contractorNotification._id] },
    });
    console.log('✅ Cleanup completed.');

    console.log('\n========================================');
    console.log('🎉 ALL INTEGRATION TESTS PASSED SUCCESSFULLY!');
    console.log('========================================');
  } finally {
    await mongoose.disconnect();
    console.log('MongoDB disconnected.');
  }
}

runTests().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
