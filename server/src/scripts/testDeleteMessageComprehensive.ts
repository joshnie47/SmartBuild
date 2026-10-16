import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import dns from 'dns';
import { User } from '../models/User';
import { Conversation } from '../models/Conversation';
import { Message } from '../models/Message';
import { generateToken } from '../middleware/auth';
import { getChatGridFSBucket } from '../config/gridfs';

dns.setServers(['8.8.8.8', '8.8.4.4']);
dotenv.config({ path: path.join(__dirname, '../../.env') });

const samplePngBuffer = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);
const samplePdfBuffer = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF');

async function run() {
  console.log('===============================================================');
  console.log('   DELETE MESSAGE COMPREHENSIVE E2E VERIFICATION TEST SUITE     ');
  console.log('===============================================================\n');

  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/smartbuild';
  console.log('Connecting to MongoDB Atlas...');
  await mongoose.connect(mongoUri);

  try {
    const bucket = getChatGridFSBucket();

    // 1. Find a conversation with at least 2 participants
    const conv = await Conversation.findOne({ 'participants.1': { $exists: true } });
    if (!conv) {
      throw new Error('No conversation found with at least 2 participants.');
    }

    const p0 = conv.participants[0];
    const p1 = conv.participants[1];
    const userA = await User.findById(p0.userId);
    const userB = await User.findById(p1.userId);

    if (!userA || !userB) {
      throw new Error('Could not find users for participants');
    }

    const tokenA = generateToken(userA._id.toString(), userA.role || 'CLIENT');
    const tokenB = generateToken(userB._id.toString(), userB.role || 'CONTRACTOR');
    const convId = conv._id.toString();

    console.log(`Test Conversation: ${convId}`);
    console.log(`Participant A (Sender):    ${userA.fullName} (${userA._id}, role: ${userA.role})`);
    console.log(`Participant B (Recipient): ${userB.fullName} (${userB._id}, role: ${userB.role})\n`);

    const baseUrl = 'http://127.0.0.1:5000/api/conversations';

    // ──────────────────────────────────────────────────────────────────────────
    // TEST 1: Delete a text message sent by Participant A
    // ──────────────────────────────────────────────────────────────────────────
    console.log('─── TEST 1: Delete a text message sent by current user ───');
    let textMsgId: string;
    {
      const sendRes = await fetch(`${baseUrl}/${convId}/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tokenA}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          body: 'Automated test text message to be deleted',
          clientMessageId: `test-del-txt-${Date.now()}`,
        }),
      });

      const sendData = await sendRes.json();
      if (sendRes.status !== 201) {
        throw new Error(`Failed to send test text message: ${JSON.stringify(sendData)}`);
      }
      textMsgId = sendData.message._id;
      console.log(`Created test text message ID: ${textMsgId}`);

      // Delete message with Token A (Sender)
      const delRes = await fetch(`${baseUrl}/${convId}/messages/${textMsgId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${tokenA}` },
      });
      const delData = await delRes.json();
      console.log(`DELETE status: ${delRes.status}`, delData);
      if (delRes.status !== 200 || !delData.success) {
        throw new Error(`Expected 200 OK on text message delete, got ${delRes.status}`);
      }

      // Verify in DB soft-delete state
      const dbMsg = await Message.findById(textMsgId);
      if (!dbMsg || !dbMsg.deletedAt) {
        throw new Error(`Expected message in DB to have deletedAt set, found: ${dbMsg?.deletedAt}`);
      }
      console.log(`Verified DB soft-delete: message.deletedAt = ${dbMsg.deletedAt.toISOString()}`);

      // Verify Participant A getMessages does not return this message
      const getResA = await fetch(`${baseUrl}/${convId}/messages`, {
        headers: { Authorization: `Bearer ${tokenA}` },
      });
      const getDataA = await getResA.json();
      const inSenderView = getDataA.messages?.some((m: any) => m._id === textMsgId);
      if (inSenderView) {
        throw new Error('Deleted text message still visible in Participant A (Sender) messages list!');
      }

      // Verify Participant B getMessages does not return this message
      const getResB = await fetch(`${baseUrl}/${convId}/messages`, {
        headers: { Authorization: `Bearer ${tokenB}` },
      });
      const getDataB = await getResB.json();
      const inRecipientView = getDataB.messages?.some((m: any) => m._id === textMsgId);
      if (inRecipientView) {
        throw new Error('Deleted text message still visible in Participant B (Recipient) messages list!');
      }

      console.log('✅ TEST 1 PASSED: Text message deleted, hidden for both participants.');
    }

    // ──────────────────────────────────────────────────────────────────────────
    // TEST 2: Delete an image message and clean up GridFS
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n─── TEST 2: Delete an image message and safely clean up GridFS ───');
    {
      const formData = new FormData();
      formData.append('body', 'Automated test image message to be deleted');
      formData.append('clientMessageId', `test-del-img-${Date.now()}`);
      formData.append(
        'files',
        new Blob([samplePngBuffer], { type: 'image/png' }),
        'delete_test_photo.png'
      );

      const sendRes = await fetch(`${baseUrl}/${convId}/messages`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenA}` },
        body: formData,
      });

      const sendData = await sendRes.json();
      if (sendRes.status !== 201) {
        throw new Error(`Failed to upload test image message: ${JSON.stringify(sendData)}`);
      }

      const imgMsgId = sendData.message._id;
      const fileId = sendData.message.attachment?.fileId || sendData.message.attachments?.[0]?.fileId;
      console.log(`Created image message ID: ${imgMsgId}, GridFS fileId: ${fileId}`);

      // Verify file exists in GridFS bucket
      const fileIdObj = new mongoose.Types.ObjectId(fileId);
      const filesBefore = await bucket.find({ _id: fileIdObj }).toArray();
      if (filesBefore.length === 0) {
        throw new Error(`File was not found in GridFS before deletion: ${fileId}`);
      }
      console.log(`Verified file exists in GridFS bucket: ${filesBefore[0].filename} (${filesBefore[0].length} bytes)`);

      // Delete message with Token A
      const delRes = await fetch(`${baseUrl}/${convId}/messages/${imgMsgId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${tokenA}` },
      });
      const delData = await delRes.json();
      console.log(`DELETE status: ${delRes.status}`, delData);
      if (delRes.status !== 200 || !delData.success) {
        throw new Error(`Expected 200 OK on image message delete, got ${delRes.status}`);
      }

      // Verify file is removed from GridFS bucket
      const filesAfter = await bucket.find({ _id: fileIdObj }).toArray();
      if (filesAfter.length > 0) {
        throw new Error(`File STILL EXISTS in GridFS bucket after deletion: ${fileId}`);
      }
      console.log('Verified GridFS binary was removed from bucket.');

      // Verify attachment stream now returns 404
      const streamRes = await fetch(`${baseUrl}/${convId}/attachments/${fileId}`, {
        headers: { Authorization: `Bearer ${tokenA}` },
      });
      console.log(`Attachment stream status after deletion: ${streamRes.status}`);
      if (streamRes.status !== 404) {
        throw new Error(`Expected 404 on deleted attachment stream, got ${streamRes.status}`);
      }

      // Verify message does not appear in conversation for A or B
      const getResB = await fetch(`${baseUrl}/${convId}/messages`, {
        headers: { Authorization: `Bearer ${tokenB}` },
      });
      const getDataB = await getResB.json();
      if (getDataB.messages?.some((m: any) => m._id === imgMsgId)) {
        throw new Error('Deleted image message still appears in recipient view!');
      }

      console.log('✅ TEST 2 PASSED: Image message and GridFS binary successfully removed.');
    }

    // ──────────────────────────────────────────────────────────────────────────
    // TEST 3: Delete a PDF document message and clean up GridFS
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n─── TEST 3: Delete a PDF document message and safely clean up GridFS ───');
    {
      const formData = new FormData();
      formData.append('body', 'Automated test PDF document to be deleted');
      formData.append('clientMessageId', `test-del-doc-${Date.now()}`);
      formData.append(
        'files',
        new Blob([samplePdfBuffer], { type: 'application/pdf' }),
        'specifications_test.pdf'
      );

      const sendRes = await fetch(`${baseUrl}/${convId}/messages`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenA}` },
        body: formData,
      });

      const sendData = await sendRes.json();
      if (sendRes.status !== 201) {
        throw new Error(`Failed to upload test doc message: ${JSON.stringify(sendData)}`);
      }

      const docMsgId = sendData.message._id;
      const fileId = sendData.message.attachment?.fileId || sendData.message.attachments?.[0]?.fileId;
      console.log(`Created PDF message ID: ${docMsgId}, GridFS fileId: ${fileId}`);

      const fileIdObj = new mongoose.Types.ObjectId(fileId);
      const filesBefore = await bucket.find({ _id: fileIdObj }).toArray();
      if (filesBefore.length === 0) {
        throw new Error(`PDF file was not found in GridFS before deletion: ${fileId}`);
      }
      console.log(`Verified PDF exists in GridFS bucket: ${filesBefore[0].filename}`);

      // Delete message with Token A
      const delRes = await fetch(`${baseUrl}/${convId}/messages/${docMsgId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${tokenA}` },
      });
      const delData = await delRes.json();
      console.log(`DELETE status: ${delRes.status}`, delData);
      if (delRes.status !== 200 || !delData.success) {
        throw new Error(`Expected 200 OK on PDF message delete, got ${delRes.status}`);
      }

      // Verify GridFS cleanup
      const filesAfter = await bucket.find({ _id: fileIdObj }).toArray();
      if (filesAfter.length > 0) {
        throw new Error(`PDF file STILL EXISTS in GridFS bucket after deletion: ${fileId}`);
      }
      console.log('Verified PDF GridFS binary was removed.');

      console.log('✅ TEST 3 PASSED: PDF message and GridFS binary successfully removed.');
    }

    // ──────────────────────────────────────────────────────────────────────────
    // TEST 4: Authorization: Participant B cannot delete Participant A's message
    // ──────────────────────────────────────────────────────────────────────────
    console.log("\n─── TEST 4: Security/Auth: User cannot delete another user's message ───");
    {
      const sendRes = await fetch(`${baseUrl}/${convId}/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tokenA}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          body: "Participant A's private message that B cannot delete",
          clientMessageId: `test-auth-sec-${Date.now()}`,
        }),
      });
      const sendData = await sendRes.json();
      const targetMsgId = sendData.message._id;

      // Participant B tries to delete Participant A's message
      const unauthorizedDelRes = await fetch(`${baseUrl}/${convId}/messages/${targetMsgId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${tokenB}` },
      });
      const unauthorizedData = await unauthorizedDelRes.json();
      console.log(`Attempted unauthorized delete status: ${unauthorizedDelRes.status}`, unauthorizedData);

      if (unauthorizedDelRes.status !== 403) {
        throw new Error(`Expected 403 Forbidden for unauthorized deletion, got ${unauthorizedDelRes.status}`);
      }

      // Verify message is STILL intact
      const dbMsg = await Message.findById(targetMsgId);
      if (dbMsg?.deletedAt) {
        throw new Error('Message was incorrectly deleted by unauthorized user!');
      }
      console.log('Verified message is still intact in DB with deletedAt = null');

      // Clean up test message properly with Token A
      await fetch(`${baseUrl}/${convId}/messages/${targetMsgId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${tokenA}` },
      });

      console.log("✅ TEST 4 PASSED: Unauthorized user cannot delete other participant's message.");
    }

    // ──────────────────────────────────────────────────────────────────────────
    // TEST 5: Error handling: Invalid message ID and mismatched conversation ID
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n─── TEST 5: Error handling for invalid message ID and wrong conversation ID ───');
    {
      const fakeMsgId = new mongoose.Types.ObjectId().toString();
      const invalidRes = await fetch(`${baseUrl}/${convId}/messages/${fakeMsgId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${tokenA}` },
      });
      console.log(`Non-existent message delete status: ${invalidRes.status}`);
      if (invalidRes.status !== 404) {
        throw new Error(`Expected 404 for non-existent message, got ${invalidRes.status}`);
      }

      // Wrong conversation ID test
      const sendRes = await fetch(`${baseUrl}/${convId}/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tokenA}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          body: 'Message for wrong conv test',
          clientMessageId: `test-wrong-conv-${Date.now()}`,
        }),
      });
      const sendData = await sendRes.json();
      const validMsgId = sendData.message._id;

      const fakeConvId = new mongoose.Types.ObjectId().toString();
      const wrongConvRes = await fetch(`${baseUrl}/${fakeConvId}/messages/${validMsgId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${tokenA}` },
      });
      console.log(`Wrong conversation ID status: ${wrongConvRes.status}`);
      if (wrongConvRes.status !== 400 && wrongConvRes.status !== 403 && wrongConvRes.status !== 404) {
        throw new Error(`Expected error code (400/403/404) for mismatched conversation, got ${wrongConvRes.status}`);
      }

      // Clean up
      await fetch(`${baseUrl}/${convId}/messages/${validMsgId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${tokenA}` },
      });

      console.log('✅ TEST 5 PASSED: Invalid and mismatched IDs handled safely.');
    }

    // ──────────────────────────────────────────────────────────────────────────
    // TEST 6: Conversation lastMessage synchronization
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n─── TEST 6: Conversation lastMessage re-synchronization on delete ───');
    {
      // Send message 1
      const msg1Res = await fetch(`${baseUrl}/${convId}/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tokenA}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          body: 'Base message 1 that should become lastMessage',
          clientMessageId: `test-sync-1-${Date.now()}`,
        }),
      });
      const msg1Data = await msg1Res.json();

      // Send message 2 (newest)
      const msg2Res = await fetch(`${baseUrl}/${convId}/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tokenA}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          body: 'Temporary top message 2 to be deleted',
          clientMessageId: `test-sync-2-${Date.now()}`,
        }),
      });
      const msg2Data = await msg2Res.json();
      const msg2Id = msg2Data.message._id;

      // Check conversation lastMessage is message 2
      let updatedConv = await Conversation.findById(convId);
      console.log(`Conversation lastMessage before delete: "${updatedConv?.lastMessage?.body}"`);

      // Delete message 2
      await fetch(`${baseUrl}/${convId}/messages/${msg2Id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${tokenA}` },
      });

      // Verify conversation lastMessage reverted to message 1
      updatedConv = await Conversation.findById(convId);
      console.log(`Conversation lastMessage after delete: "${updatedConv?.lastMessage?.body}"`);
      if (updatedConv?.lastMessage?.body !== 'Base message 1 that should become lastMessage') {
        throw new Error(`Expected lastMessage to revert to message 1, got "${updatedConv?.lastMessage?.body}"`);
      }

      // Clean up message 1
      await fetch(`${baseUrl}/${convId}/messages/${msg1Data.message._id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${tokenA}` },
      });

      console.log('✅ TEST 6 PASSED: Conversation lastMessage re-synchronized correctly.');
    }

    console.log('\n===============================================================');
    console.log('      ALL 6 TESTS PASSED FULLY AND SUCCESSFULLY! 🎉            ');
    console.log('===============================================================\n');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ TEST RUNNER FAILED WITH ERROR:', err);
    process.exit(1);
  }
}

run();
