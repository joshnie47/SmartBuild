import dns from 'dns';
try {
  dns.setDefaultResultOrder('ipv4first');
  dns.setServers(['8.8.8.8', '8.8.4.4']);
} catch {
  // ignore
}

import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import http from 'http';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import { User } from '../src/models/User';
import { Project } from '../src/models/Project';
import { Bid } from '../src/models/Bid';
import { Conversation } from '../src/models/Conversation';
import { Message } from '../src/models/Message';
import { Notification } from '../src/models/Notification';
import { generateToken } from '../src/middleware/auth';
import conversationsRouter from '../src/routes/conversations';
import notificationsRouter from '../src/routes/notifications';
import { deleteFromGridFS } from '../src/config/gridfs';

async function runHttpTests() {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGO_URI is missing');

  await mongoose.connect(uri);
  console.log('✅ Connected to MongoDB Atlas');

  // Create temporary express app for HTTP testing
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use('/api/conversations', conversationsRouter);
  app.use('/api/notifications', notificationsRouter);

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as { port: number };
  const baseUrl = `http://localhost:${address.port}`;
  console.log(`✅ Test server running on ${baseUrl}`);

  try {
    // 1. Setup users and conversation
    const contractor = await User.findOneAndUpdate(
      { email: 'http_test_contractor@smartbuild.test' },
      {
        fullName: 'HTTP Test Contractor',
        email: 'http_test_contractor@smartbuild.test',
        phone: '+919999990011',
        role: 'CONTRACTOR',
      },
      { upsert: true, new: true }
    );

    const client = await User.findOneAndUpdate(
      { email: 'http_test_client@smartbuild.test' },
      {
        fullName: 'HTTP Test Client',
        email: 'http_test_client@smartbuild.test',
        phone: '+919999990012',
        role: 'CLIENT',
      },
      { upsert: true, new: true }
    );

    const outsider = await User.findOneAndUpdate(
      { email: 'http_test_outsider@smartbuild.test' },
      {
        fullName: 'HTTP Test Outsider',
        email: 'http_test_outsider@smartbuild.test',
        phone: '+919999990013',
        role: 'CLIENT',
      },
      { upsert: true, new: true }
    );

    const contractorToken = generateToken(contractor._id.toString(), 'CONTRACTOR');
    const clientToken = generateToken(client._id.toString(), 'CLIENT');
    const outsiderToken = generateToken(outsider._id.toString(), 'CLIENT');

    const project = await Project.findOneAndUpdate(
      { title: 'HTTP Chat Test Project' },
      {
        clientId: client._id,
        title: 'HTTP Chat Test Project',
        description: 'Test project for HTTP chat endpoints',
        category: 'Residential Construction',
        status: 'In Progress',
        budget: 60000,
        timeline: '1 month',
        location: 'Delhi',
      },
      { upsert: true, new: true }
    );

    const bid = await Bid.findOneAndUpdate(
      { projectId: project._id, contractorId: contractor._id },
      {
        projectId: project._id,
        contractorId: contractor._id,
        amount: 55000,
        estimatedDays: 15,
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

    // ── Test 1: Contractor uploads an image (JPG) via multipart POST /api/conversations/:id/messages ──
    console.log('\n--- HTTP Test 1: POST /api/conversations/:id/messages (Image) ---');
    const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
    const fakeImageBuffer = Buffer.from('FAKE_JPG_IMAGE_DATA_BYTES_12345');
    const parts = [
      `--${boundary}\r\nContent-Disposition: form-data; name="body"\r\n\r\nHere is the roof inspection photo\r\n`,
      `--${boundary}\r\nContent-Disposition: form-data; name="clientMessageId"\r\n\r\nclient-uuid-img-1\r\n`,
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="roof_inspection.jpg"\r\nContent-Type: image/jpeg\r\n\r\n`,
    ];

    const bodyBuffer = Buffer.concat([
      Buffer.from(parts[0]),
      Buffer.from(parts[1]),
      Buffer.from(parts[2]),
      fakeImageBuffer,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);

    const postImgRes = await fetch(`${baseUrl}/api/conversations/${convId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${contractorToken}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
      body: bodyBuffer,
    });

    if (postImgRes.status !== 201) {
      const errText = await postImgRes.text();
      throw new Error(`POST image message failed with ${postImgRes.status}: ${errText}`);
    }

    const postImgJson = (await postImgRes.json()) as { message: { _id: string; messageType: string; attachment?: { fileId: string; filename: string } } };
    console.log('✅ Image message created with status 201:', postImgJson.message._id);
    if (postImgJson.message.messageType !== 'image' || !postImgJson.message.attachment?.fileId) {
      throw new Error('FAILED: message response did not have expected messageType or attachment');
    }
    const imgFileId = postImgJson.message.attachment.fileId;

    // ── Test 2: Client retrieves conversation messages via GET /api/conversations/:id/messages ──
    console.log('\n--- HTTP Test 2: GET /api/conversations/:id/messages (History) ---');
    const getMsgsRes = await fetch(`${baseUrl}/api/conversations/${convId}/messages`, {
      headers: { Authorization: `Bearer ${clientToken}` },
    });
    if (getMsgsRes.status !== 200) throw new Error(`GET messages failed with ${getMsgsRes.status}`);
    const getMsgsJson = (await getMsgsRes.json()) as { messages: Array<{ _id: string; messageType: string; attachment?: { fileId: string; url: string } }> };
    const foundImgMsg = getMsgsJson.messages.find((m) => m._id === postImgJson.message._id);
    if (!foundImgMsg || !foundImgMsg.attachment?.url) {
      throw new Error('FAILED: Image message or attachment URL not found in message history');
    }
    console.log('✅ Client successfully retrieved message with attachment URL:', foundImgMsg.attachment.url);

    // ── Test 3: Client streams/downloads attachment via GET /api/conversations/:id/attachments/:fileId ──
    console.log('\n--- HTTP Test 3: GET /api/conversations/:id/attachments/:fileId ---');
    const streamRes = await fetch(`${baseUrl}/api/conversations/${convId}/attachments/${imgFileId}`, {
      headers: { Authorization: `Bearer ${clientToken}` },
    });
    if (streamRes.status !== 200) throw new Error(`Streaming failed with ${streamRes.status}`);
    const contentType = streamRes.headers.get('content-type');
    const disposition = streamRes.headers.get('content-disposition');
    const streamedArrayBuffer = await streamRes.arrayBuffer();
    const streamedBuffer = Buffer.from(streamedArrayBuffer);

    if (contentType !== 'image/jpeg') throw new Error(`Expected image/jpeg but got ${contentType}`);
    if (!disposition?.includes('roof_inspection.jpg')) throw new Error(`Filename not in Content-Disposition: ${disposition}`);
    if (streamedBuffer.toString() !== fakeImageBuffer.toString()) throw new Error('Streamed data does not match uploaded data');
    console.log('✅ Client successfully streamed image binary from GridFS with correct headers!');

    // ── Test 4: Client streams using query parameter token (for inline <img src="...">) ──
    console.log('\n--- HTTP Test 4: GET attachment with ?token= query parameter ---');
    const queryTokenRes = await fetch(`${baseUrl}/api/conversations/${convId}/attachments/${imgFileId}?token=${clientToken}`);
    if (queryTokenRes.status !== 200) throw new Error(`Query token stream failed with ${queryTokenRes.status}`);
    console.log('✅ Attachment successfully streamed using query parameter token!');

    // ── Test 5: Authorization Security: Outsider user attempts to access attachment ──
    console.log('\n--- HTTP Test 5: Security: Outsider Access Rejection (403 Forbidden) ---');
    const outsiderRes = await fetch(`${baseUrl}/api/conversations/${convId}/attachments/${imgFileId}`, {
      headers: { Authorization: `Bearer ${outsiderToken}` },
    });
    if (outsiderRes.status === 403) {
      console.log('✅ Security check passed: Outsider user correctly blocked with 403 Forbidden!');
    } else {
      throw new Error(`FAILED: Outsider received status ${outsiderRes.status} instead of 403 Forbidden`);
    }

    // ── Test 6: Client uploads a document (PDF) via POST /api/conversations/:id/messages ──
    console.log('\n--- HTTP Test 6: POST /api/conversations/:id/messages (Document PDF) ---');
    const pdfBoundary = '----WebKitFormBoundaryDocTest77';
    const fakePdfBuffer = Buffer.from('%PDF-1.4 FakeSignedContractBlueprint');
    const docParts = [
      `--${pdfBoundary}\r\nContent-Disposition: form-data; name="body"\r\n\r\nSigned contract agreement\r\n`,
      `--${pdfBoundary}\r\nContent-Disposition: form-data; name="clientMessageId"\r\n\r\nclient-uuid-doc-1\r\n`,
      `--${pdfBoundary}\r\nContent-Disposition: form-data; name="file"; filename="contract_signed.pdf"\r\nContent-Type: application/pdf\r\n\r\n`,
    ];

    const docBodyBuffer = Buffer.concat([
      Buffer.from(docParts[0]),
      Buffer.from(docParts[1]),
      Buffer.from(docParts[2]),
      fakePdfBuffer,
      Buffer.from(`\r\n--${pdfBoundary}--\r\n`),
    ]);

    const postDocRes = await fetch(`${baseUrl}/api/conversations/${convId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${clientToken}`,
        'Content-Type': `multipart/form-data; boundary=${pdfBoundary}`,
      },
      body: docBodyBuffer,
    });

    if (postDocRes.status !== 201) throw new Error(`POST document failed with ${postDocRes.status}`);
    const postDocJson = (await postDocRes.json()) as { message: { _id: string; messageType: string; attachment?: { fileId: string } } };
    console.log('✅ Document message created with status 201:', postDocJson.message._id);
    const pdfFileId = postDocJson.message.attachment!.fileId;

    // ── Test 7: Contractor receives notification via GET /api/notifications ──
    console.log('\n--- HTTP Test 7: GET /api/notifications (Contractor Receives Notification) ---');
    const notifRes = await fetch(`${baseUrl}/api/notifications`, {
      headers: { Authorization: `Bearer ${contractorToken}` },
    });
    if (notifRes.status !== 200) throw new Error(`GET notifications failed with ${notifRes.status}`);
    const notifJson = (await notifRes.json()) as { notifications: Array<{ title: string; message: string; type: string }> };
    const docNotif = notifJson.notifications.find((n) => n.title.includes('document') || n.message.includes('contract_signed.pdf'));
    if (!docNotif) throw new Error('FAILED: Document notification not found in contractor notifications');
    console.log('✅ Contractor notification confirmed in API response:', docNotif.title, '-', docNotif.message);

    // ── Test 8: Plain text message backwards compatibility ──
    console.log('\n--- HTTP Test 8: Plain Text Message Compatibility ---');
    const textRes = await fetch(`${baseUrl}/api/conversations/${convId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${contractorToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        body: 'Thank you for the document. We will review it shortly.',
        clientMessageId: `text-uuid-${Date.now()}`,
      }),
    });
    if (textRes.status !== 201) throw new Error(`POST text message failed with ${textRes.status}`);
    const textJson = (await textRes.json()) as { message: { _id: string; messageType: string; body: string } };
    if (textJson.message.messageType !== 'text' || !textJson.message.body) {
      throw new Error('FAILED: Plain text message did not match expected structure');
    }
    console.log('✅ Plain text message created successfully and verified backwards compatible.');

    // ── Cleanup ──
    console.log('\n--- Cleaning up HTTP test resources ---');
    await deleteFromGridFS(imgFileId);
    await deleteFromGridFS(pdfFileId);
    await Message.deleteMany({ conversationId: conversation._id });
    await Notification.deleteMany({ recipientId: { $in: [client._id, contractor._id] } });
    console.log('✅ Cleanup completed.');

    console.log('\n========================================');
    console.log('🎉 ALL HTTP API & SECURITY TESTS PASSED!');
    console.log('========================================');
  } finally {
    server.close();
    await mongoose.disconnect();
  }
}

runHttpTests().catch((err) => {
  console.error('❌ HTTP Test failed:', err);
  process.exit(1);
});
