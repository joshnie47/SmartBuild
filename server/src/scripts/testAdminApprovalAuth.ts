import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

async function runTest() {
  try {
    const adminToken = jwt.sign(
      { userId: 'admin-test-id', role: 'ADMIN' },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '7d' }
    );

    // 1. Fetch contractors list from running backend server
    const listRes = await fetch('http://localhost:5000/api/admin/contractors', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const listData = await listRes.json();
    console.log(`GET /api/admin/contractors Status: ${listRes.status}, count: ${listData.contractors?.length || 0}`);

    const contractor = listData.contractors?.[0];
    if (!contractor) {
      console.log('No contractors found on backend.');
      return;
    }

    console.log(`Testing admin document approval for contractor "${contractor.fullName}" (_id: ${contractor._id})`);

    // 2. Test PATCH /api/admin/contractors/:id/document-verification
    const response = await fetch(`http://localhost:5000/api/admin/contractors/${contractor._id}/document-verification`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        verificationStatus: 'AUTOMATED_VERIFICATION_PASSED',
        adminNotes: 'Admin manual override approved',
      }),
    });

    const data = await response.json();
    console.log(`\nAPI Response Status: ${response.status}`);
    console.log(`API Response Data:`, data);

    if (response.ok && data.profile) {
      console.log('SUCCESS: Admin document verification approval API succeeded with HTTP 200 OK!');
      console.log(`Updated Verification Status: ${(data.profile.documentVerification as any)?.verificationStatus}`);
    } else {
      console.error('FAILED: API returned error:', data);
    }
  } catch (err) {
    console.error('Error running test:', err);
  }
}

runTest();
