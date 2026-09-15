import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { connectDB } from '../config/db';
import { User } from '../models/User';
import { Project } from '../models/Project';
import { generateToken } from '../middleware/auth';
import { getCategoryStages } from '../utils/trackingStages';

import express from 'express';
import cors from 'cors';
import projectsRouter from '../routes/projects';

dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

async function runTest() {
  console.log('--- Starting End-to-End Contractor to Client Evidence Photo Flow Test ---');
  await connectDB();

  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use('/uploads', express.static(path.join(__dirname, '..', '..', 'uploads')));
  app.use('/api/projects', projectsRouter);

  const PORT = 5002;
  const server = app.listen(PORT);
  console.log(`✓ Test Express server listening on http://localhost:${PORT}`);

  // 1. Create or retrieve test Client and Contractor users
  let clientUser = await User.findOne({ email: 'e2e_client_test@smartbuild.com' });
  if (!clientUser) {
    clientUser = await User.create({
      fullName: 'E2E Test Client',
      email: 'e2e_client_test@smartbuild.com',
      phone: '9998887771',
      password: 'Password123!',
      role: 'CLIENT',
      status: 'ACTIVE',
    });
  }

  let contractorUser = await User.findOne({ email: 'e2e_contractor_test@smartbuild.com' });
  if (!contractorUser) {
    contractorUser = await User.create({
      fullName: 'E2E Test Contractor',
      email: 'e2e_contractor_test@smartbuild.com',
      phone: '9998887772',
      password: 'Password123!',
      role: 'CONTRACTOR',
      status: 'ACTIVE',
      specialization: 'Civil Construction',
      isVerified: true,
    });
  }

  const secret = process.env.JWT_SECRET || 'smartbuild_super_secret_jwt_key_2026';
  const clientToken = jwt.sign(
    { userId: (clientUser._id as mongoose.Types.ObjectId).toString(), role: 'CLIENT' },
    secret,
    { expiresIn: '7d' }
  );
  const contractorToken = jwt.sign(
    { userId: (contractorUser._id as mongoose.Types.ObjectId).toString(), role: 'CONTRACTOR' },
    secret,
    { expiresIn: '7d' }
  );

  // 2. Create test project
  const testProject = await Project.create({
    title: 'E2E Photo Flow Test Project',
    description: 'Testing contractor to client photo synchronization flow',
    category: 'Civil Construction',
    budget: 150000,
    timeline: '3 weeks',
    location: 'Coimbatore',
    clientId: clientUser._id,
    selectedContractorId: contractorUser._id,
    status: 'IN_PROGRESS',
    milestones: getCategoryStages('Civil Construction'),
  });

  console.log(`✓ Test project created: ID ${testProject._id}`);

  // 3. Test evidence validation via fetch API (Contractor upload)
  const baseUrl = `http://localhost:5002/api`;

  // Create a dummy image buffer (JPEG header)
  const dummyJpegBuffer = Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x60,
    0x00, 0x60, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43, 0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08,
    0x07, 0x07, 0x07, 0x09, 0x09, 0x08, 0x0a, 0x0c, 0x14, 0x0d, 0x0c, 0x0b, 0x0b, 0x0c, 0x19, 0x12,
    0x13, 0x0f, 0x14, 0x1d, 0x1a, 0x1f, 0x1e, 0x1d, 0x1a, 0x1c, 0x1c, 0x20, 0x24, 0x2e, 0x27, 0x20,
    0x22, 0x2c, 0x23, 0x1c, 0x1c, 0x28, 0x37, 0x29, 0x2c, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1f, 0x27,
    0x39, 0x3d, 0x38, 0x32, 0x3c, 0x2e, 0x33, 0x34, 0x32, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x08,
    0x00, 0x08, 0x01, 0x01, 0x11, 0x00, 0xff, 0xc4, 0x00, 0x1f, 0x00, 0x00, 0x01, 0x05, 0x01, 0x01,
    0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04,
    0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f,
    0x00, 0x7f, 0x00, 0x00, 0x00, 0x00, 0x00, 0xff, 0xd9
  ]);
  const base64Jpeg = `data:image/jpeg;base64,${dummyJpegBuffer.toString('base64')}`;

  console.log('\n--- 1. Contractor Validating Evidence Photo ---');
  const valRes = await fetch(`${baseUrl}/projects/${testProject._id}/validate-evidence`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${contractorToken}`,
    },
    body: JSON.stringify({ images: [base64Jpeg] }),
  });

  const valData = (await valRes.json()) as any;
  console.log('Validation API response status:', valRes.status);
  console.log('Validation result:', JSON.stringify(valData, null, 2));

  if (!valData.results || valData.results.length === 0 || !valData.results[0].evidenceItem) {
    throw new Error('Evidence validation failed to return an evidenceItem!');
  }

  const verifiedItem = valData.results[0].evidenceItem;
  const verifiedUrl = valData.results[0].photoUrl;

  console.log(`✓ Validated photo URL: ${verifiedUrl}`);

  // 4. Contractor Marking Stage 1 Complete with persistent evidence photos
  console.log('\n--- 2. Contractor Completing Stage 1 with Photo ---');
  const milestone1Id = testProject.milestones[0].id;
  const updateRes = await fetch(`${baseUrl}/projects/${testProject._id}/milestone`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${contractorToken}`,
    },
    body: JSON.stringify({
      milestoneId: milestone1Id,
      status: 'completed',
      note: 'Site inspection completed successfully with soil testing.',
      photo: verifiedUrl,
      photos: [verifiedUrl],
      evidenceItems: [verifiedItem],
    }),
  });

  const updateData = (await updateRes.json()) as any;
  console.log('Milestone update API status:', updateRes.status);
  if (updateRes.status !== 200) {
    throw new Error(`Milestone update failed: ${JSON.stringify(updateData)}`);
  }

  // 5. Verify Direct MongoDB Persistence
  console.log('\n--- 3. Verifying Direct MongoDB Persistence ---');
  const dbProject = await Project.findById(testProject._id);
  const dbStage1 = dbProject?.milestones.find((m) => m.id === milestone1Id);

  console.log('DB Stage 1 Status:', dbStage1?.status);
  console.log('DB Stage 1 Photo:', dbStage1?.photo);
  console.log('DB Stage 1 Photos Array:', dbStage1?.photos);
  console.log('DB Stage 1 EvidenceItems:', dbStage1?.evidenceItems);

  if (!dbStage1 || dbStage1.status !== 'completed') {
    throw new Error('MongoDB does not show Stage 1 as completed!');
  }
  if (!dbStage1.photos || dbStage1.photos.length === 0 || dbStage1.photos[0] !== verifiedUrl) {
    throw new Error('MongoDB photos array is missing or incorrect!');
  }
  if (!dbStage1.evidenceItems || dbStage1.evidenceItems.length === 0) {
    throw new Error('MongoDB evidenceItems array is missing!');
  }

  console.log('✓ Direct MongoDB persistence verified!');

  // 6. Client Fetching Project Tracking Data
  console.log('\n--- 4. Client Fetching Project Tracking API ---');
  const clientGetRes = await fetch(`${baseUrl}/projects/${testProject._id}`, {
    headers: {
      Authorization: `Bearer ${clientToken}`,
    },
  });

  const clientGetData = (await clientGetRes.json()) as any;
  console.log('Client GET Project API status:', clientGetRes.status);

  const clientProject = clientGetData.project;
  const clientStage1 = clientProject?.milestones.find((m: any) => m.id === milestone1Id);

  console.log('Client API Stage 1 Status:', clientStage1?.status);
  console.log('Client API Stage 1 Photos:', clientStage1?.photos);
  console.log('Client API Stage 1 EvidenceItems:', clientStage1?.evidenceItems);

  if (!clientStage1 || clientStage1.status !== 'completed') {
    throw new Error('Client API did not return completed stage!');
  }
  if (!clientStage1.photos || clientStage1.photos.length === 0) {
    throw new Error('Client API response is missing evidence photos!');
  }
  if (clientStage1.photos[0] !== verifiedUrl) {
    throw new Error(`Photo URL mismatch! Expected ${verifiedUrl}, got ${clientStage1.photos[0]}`);
  }

  console.log('✓ Client API retrieval verified!');

  // 7. Test Optional Photo Flow (Stage 2 completion without photos)
  console.log('\n--- 5. Testing Optional Photo Stage Completion (Stage 2) ---');
  const milestone2Id = testProject.milestones[1].id;
  const optRes = await fetch(`${baseUrl}/projects/${testProject._id}/milestone`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${contractorToken}`,
    },
    body: JSON.stringify({
      milestoneId: milestone2Id,
      status: 'completed',
      note: 'Procured cement and steel reinforcement bars.',
    }),
  });

  const optData = (await optRes.json()) as any;
  console.log('Stage 2 update API status:', optRes.status);
  if (optRes.status !== 200) {
    throw new Error(`Stage 2 update failed: ${JSON.stringify(optData)}`);
  }

  const clientGetRes2 = await fetch(`${baseUrl}/projects/${testProject._id}`, {
    headers: { Authorization: `Bearer ${clientToken}` },
  });
  const clientGetData2 = (await clientGetRes2.json()) as any;
  const clientStage2 = clientGetData2.project?.milestones.find((m: any) => m.id === milestone2Id);

  console.log('Client API Stage 2 Status:', clientStage2?.status);
  console.log('Client API Stage 2 Photos:', clientStage2?.photos);

  if (clientStage2?.status !== 'completed') {
    throw new Error('Stage 2 without photos failed to complete!');
  }

  console.log('✓ Optional photo stage completion verified!');

  // Cleanup test project
  await Project.findByIdAndDelete(testProject._id);
  console.log('\n=== ALL END-TO-END TESTS PASSED SUCCESSFULLY! ===');
  process.exit(0);
}

runTest().catch((err) => {
  console.error('\n❌ Test failed with error:', err);
  process.exit(1);
});
