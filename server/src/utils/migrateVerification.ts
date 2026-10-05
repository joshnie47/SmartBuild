import { User } from '../models/User';
import { ContractorProfile, IDocumentVerification } from '../models/ContractorProfile';

export async function migrateVerificationStatus(): Promise<{ migratedCount: number; verifiedCount: number; legacyCount: number }> {
  let migratedCount = 0;
  let verifiedCount = 0;
  let legacyCount = 0;

  try {
    const contractors = await User.find({ role: 'CONTRACTOR' });

    for (const user of contractors) {
      let profile = await ContractorProfile.findOne({ userId: user._id });

      if (!profile) {
        profile = await ContractorProfile.create({
          userId: user._id,
          fullName: user.fullName,
          email: user.email || '',
          phone: user.phone || '',
          primaryTrade: user.specialization || 'Civil Construction',
          city: 'Coimbatore',
          experienceYears: 5,
          kycStatus: user.kycStatus || 'PENDING',
        });
      }

      const currentDocVer = (profile.documentVerification as any)?.toObject?.() || profile.documentVerification || {};
      const isCurrentlyVerified =
        user.isVerified === true ||
        profile.kycStatus === 'VERIFIED' ||
        user.kycStatus === 'VERIFIED' ||
        currentDocVer.verificationStatus === 'VERIFIED' ||
        currentDocVer.verificationStatus === 'AUTOMATED_VERIFICATION_PASSED';

      const isExplicitlyRejected =
        user.kycStatus === 'REJECTED' ||
        profile.kycStatus === 'REJECTED' ||
        currentDocVer.verificationStatus === 'REJECTED' ||
        currentDocVer.verificationStatus === 'VERIFICATION_FAILED';

      let newStatus: 'VERIFIED' | 'VERIFICATION_REQUIRED' | 'REJECTED';
      let newMethod: 'AUTOMATED' | 'MANUAL' | 'LEGACY';
      let newReason: string = currentDocVer.verificationReason || '';

      if (isCurrentlyVerified) {
        newStatus = 'VERIFIED';
        newMethod = currentDocVer.verificationMethod || 'MANUAL';
        verifiedCount++;
      } else if (isExplicitlyRejected) {
        newStatus = 'REJECTED';
        newMethod = currentDocVer.verificationMethod || 'AUTOMATED';
        if (!newReason) newReason = 'Document verification was rejected.';
      } else {
        newStatus = 'VERIFICATION_REQUIRED';
        newMethod = currentDocVer.verificationMethod || 'LEGACY';
        newReason = newReason || 'Existing contractor has not completed document verification';
        legacyCount++;
      }

      const updatedDocVerification: IDocumentVerification = {
        ...currentDocVer,
        verificationStatus: newStatus,
        verificationMethod: newMethod,
        verificationReason: newReason,
        disclaimer:
          currentDocVer.disclaimer ||
          'Automated verification is based on OCR document processing, pattern extraction, format checking, and profile field cross-matching. It does not interface with government databases or verify official registration.',
        verifiedAt: newStatus === 'VERIFIED' ? (currentDocVer.verifiedAt || profile.updatedAt || new Date()) : currentDocVer.verifiedAt,
      };

      const targetKycStatus = newStatus === 'VERIFIED' ? 'VERIFIED' : newStatus === 'REJECTED' ? 'REJECTED' : 'PENDING';
      const targetIsVerified = newStatus === 'VERIFIED';

      let needsSave = false;

      if (
        profile.documentVerification?.verificationStatus !== newStatus ||
        profile.documentVerification?.verificationMethod !== newMethod ||
        profile.documentVerification?.verificationReason !== newReason ||
        profile.kycStatus !== targetKycStatus
      ) {
        profile.documentVerification = updatedDocVerification as any;
        profile.kycStatus = targetKycStatus;
        await profile.save();
        needsSave = true;
      }

      if (user.isVerified !== targetIsVerified || user.kycStatus !== targetKycStatus) {
        user.isVerified = targetIsVerified;
        user.kycStatus = targetKycStatus;
        await user.save();
        needsSave = true;
      }

      if (needsSave) {
        migratedCount++;
      }
    }

    console.log(`[Migration] Verification Migration completed. Total Contractors processed: ${contractors.length} (Verified: ${verifiedCount}, Legacy/Pending: ${legacyCount}, Updated: ${migratedCount})`);
  } catch (err) {
    console.error('[Migration] Error migrating verification statuses:', err);
  }

  return { migratedCount, verifiedCount, legacyCount };
}
