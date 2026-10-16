import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import dns from 'dns';
import { User } from '../models/User';
import { Conversation } from '../models/Conversation';
import { generateToken } from '../middleware/auth';

dns.setServers(['8.8.8.8', '8.8.4.4']);
dotenv.config({ path: path.join(__dirname, '../../.env') });

async function run() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/smartbuild';
  console.log('Connecting to MongoDB Atlas...');
  await mongoose.connect(mongoUri);

  try {
    // 1. Get an existing conversation
    let conv = await Conversation.findOne();
    if (!conv) {
      console.error('No conversation found in database.');
      process.exit(1);
    }

    const senderParticipant = conv.participants[0];
    const userA = await User.findById(senderParticipant.userId);
    if (!userA) {
      console.error('User not found for participant:', senderParticipant.userId);
      process.exit(1);
    }

    const token = generateToken(userA._id.toString(), userA.role || 'CLIENT');
    const convId = conv._id.toString();
    const apiUrl = `http://127.0.0.1:5000/api/conversations/${convId}/messages`;
    console.log(`Using existing conversation ${convId} with user ${userA.fullName} (${userA._id})`);

    // Tiny 1x1 PNG bytes for testing
    const samplePngBuffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64'
    );
    const samplePdfBuffer = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF');

    console.log('\n--- TEST 1: Uploading 5 images (Limit boundary test) ---');
    {
      const formData = new FormData();
      formData.append('clientMessageId', `test-5-imgs-${Date.now()}`);
      formData.append('body', 'Sending 5 site inspection photos');
      for (let i = 1; i <= 5; i++) {
        formData.append(
          'files',
          new Blob([samplePngBuffer], { type: 'image/png' }),
          `inspection_photo_${i}.png`
        );
      }

      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      const data = await res.json();
      console.log('Status:', res.status);
      if (res.status === 201) {
        console.log('SUCCESS! Message attachments count:', data.message.attachments?.length);
        console.log('Primary attachment present:', Boolean(data.message.attachment));
        const fileUrl = data.message.attachments?.[0]?.url;
        console.log('Attachment 1 URL:', fileUrl);

        // Verify attachment download/stream
        const streamRes = await fetch(`http://127.0.0.1:5000${fileUrl}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        console.log('Stream status:', streamRes.status);
        console.log('Content-Type:', streamRes.headers.get('content-type'));
        if (streamRes.status === 200 && streamRes.headers.get('content-type')?.includes('image/png')) {
          console.log('SUCCESS! GridFS streamed file binary correctly.');
        } else {
          console.error('FAILED streaming verification');
          process.exit(1);
        }
      } else {
        console.error('FAILED Test 1:', data);
        process.exit(1);
      }
    }

    console.log('\n--- TEST 2: Uploading 6 images (Exceeds limit test) ---');
    {
      const formData = new FormData();
      formData.append('clientMessageId', `test-6-imgs-${Date.now()}`);
      formData.append('body', 'Trying to send 6 images');
      for (let i = 1; i <= 6; i++) {
        formData.append(
          'files',
          new Blob([samplePngBuffer], { type: 'image/png' }),
          `too_many_${i}.png`
        );
      }

      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      const data = await res.json();
      console.log('Status:', res.status, 'Message:', data.message);
      if (res.status === 400 && data.message?.includes('up to 5 images')) {
        console.log('SUCCESS! Server correctly rejected 6 images with 400 Bad Request.');
      } else {
        console.error('FAILED Test 2:', data);
        process.exit(1);
      }
    }

    console.log('\n--- TEST 3: Uploading 1 document (Limit boundary test) ---');
    {
      const formData = new FormData();
      formData.append('clientMessageId', `test-1-doc-${Date.now()}`);
      formData.append('body', 'Architectural blueprint');
      formData.append(
        'files',
        new Blob([samplePdfBuffer], { type: 'application/pdf' }),
        'blueprint_rev1.pdf'
      );

      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      const data = await res.json();
      console.log('Status:', res.status);
      if (res.status === 201) {
        console.log('SUCCESS! Document attachment:', data.message.attachment?.filename);
        console.log('Message type:', data.message.messageType);
      } else {
        console.error('FAILED Test 3:', data);
        process.exit(1);
      }
    }

    console.log('\n--- TEST 4: Uploading 2 documents (Exceeds limit test) ---');
    {
      const formData = new FormData();
      formData.append('clientMessageId', `test-2-docs-${Date.now()}`);
      formData.append('body', 'Trying to send 2 documents');
      formData.append(
        'files',
        new Blob([samplePdfBuffer], { type: 'application/pdf' }),
        'doc_1.pdf'
      );
      formData.append(
        'files',
        new Blob([samplePdfBuffer], { type: 'application/pdf' }),
        'doc_2.pdf'
      );

      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      const data = await res.json();
      console.log('Status:', res.status, 'Message:', data.message);
      if (res.status === 400 && data.message?.includes('1 document')) {
        console.log('SUCCESS! Server correctly rejected 2 documents with 400 Bad Request.');
      } else {
        console.error('FAILED Test 4:', data);
        process.exit(1);
      }
    }

    console.log('\n--- TEST 5: Uploading mixed image + document (Disallowed combination) ---');
    {
      const formData = new FormData();
      formData.append('clientMessageId', `test-mix-${Date.now()}`);
      formData.append('body', 'Trying to send mixed types');
      formData.append(
        'files',
        new Blob([samplePngBuffer], { type: 'image/png' }),
        'site.png'
      );
      formData.append(
        'files',
        new Blob([samplePdfBuffer], { type: 'application/pdf' }),
        'contract.pdf'
      );

      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      const data = await res.json();
      console.log('Status:', res.status, 'Message:', data.message);
      if (res.status === 400 && data.message?.includes('either up to 5 images or 1 document')) {
        console.log('SUCCESS! Server correctly rejected mixed image + document.');
      } else {
        console.error('FAILED Test 5:', data);
        process.exit(1);
      }
    }

    console.log('\nALL MULTI-ATTACHMENT LIMIT TESTS PASSED PERFECTLY!\n');
  } finally {
    await mongoose.disconnect();
  }
}

run().catch((e) => {
  console.error('Error running test:', e);
  process.exit(1);
});
