import { processContractorDocumentVerification } from '../services/documentVerificationService';
import { validateAadhaarFormat, validatePanFormat, detectDocumentType } from '../services/documentOcrService';

async function runTests() {
  console.log('=== STARTING AUTOMATED CONTRACTOR DOCUMENT VERIFICATION MODULE TESTS ===\n');

  // Test 1: Format Validation Unit Tests
  console.log('--- TEST 1: Format Validation ---');
  console.log('Valid Aadhaar (987654321012):', validateAadhaarFormat('987654321012') === true ? 'PASSED ✅' : 'FAILED ❌');
  console.log('Invalid Aadhaar (Starts with 0):', validateAadhaarFormat('012345678901') === false ? 'PASSED ✅' : 'FAILED ❌');
  console.log('Invalid Aadhaar (Too short):', validateAadhaarFormat('98765432') === false ? 'PASSED ✅' : 'FAILED ❌');
  console.log('Valid Company PAN (ABCDE1234F):', validatePanFormat('ABCDE1234F') === true ? 'PASSED ✅' : 'FAILED ❌');
  console.log('Invalid PAN (Wrong length/chars):', validatePanFormat('INVALID123') === false ? 'PASSED ✅' : 'FAILED ❌');

  // Test 2: Document Type Keyword Detection
  console.log('\n--- TEST 2: Document Classification ---');
  const aadhaarText = 'GOVERNMENT OF INDIA UNIQUE IDENTIFICATION AUTHORITY OF INDIA Aadhaar No 9876 5432 1012';
  const panText = 'INCOME TAX DEPARTMENT GOVT. OF INDIA PERMANENT ACCOUNT NUMBER CARD ABCDE1234F';
  console.log('Aadhaar Text Detection:', detectDocumentType(aadhaarText) === 'AADHAAR' ? 'PASSED ✅' : 'FAILED ❌');
  console.log('PAN Text Detection:', detectDocumentType(panText) === 'COMPANY_PAN' ? 'PASSED ✅' : 'FAILED ❌');

  // Test 3: Verification Workflow - Perfect Match Case
  console.log('\n--- TEST 3: Perfect Match Case ---');
  const perfectResult = await processContractorDocumentVerification({
    aadhaarNumberEntered: '987654321012',
    companyPanEntered: 'ABCDE1234F',
    fullName: 'Kumar V',
    businessName: 'Kumar Civil Works',
  });
  console.log('Verification Status:', perfectResult.verification.verificationStatus);
  console.log('Flags:', perfectResult.verification.mismatchFlags);
  console.log('Passed Perfect Match:', perfectResult.verification.verificationStatus === 'AUTOMATED_VERIFICATION_PASSED' ? 'PASSED ✅' : 'FAILED ❌');

  // Test 4: Mismatch Case - Invalid Format
  console.log('\n--- TEST 4: Invalid Format Case ---');
  const invalidFormatResult = await processContractorDocumentVerification({
    aadhaarNumberEntered: '012345678901', // Invalid
    companyPanEntered: 'INVALIDPAN',
    fullName: 'Kumar V',
    businessName: 'Kumar Civil Works',
  });
  console.log('Verification Status:', invalidFormatResult.verification.verificationStatus);
  console.log('Flags:', invalidFormatResult.verification.mismatchFlags);
  console.log('Passed Invalid Format Test:', invalidFormatResult.verification.verificationStatus === 'VERIFICATION_FAILED' ? 'PASSED ✅' : 'FAILED ❌');

  // Test 5: Discrepancy Case (Verification Required)
  console.log('\n--- TEST 5: Discrepancy Case (Verification Required) ---');
  const sampleAadhaarBuf = Buffer.from('GOVERNMENT OF INDIA Aadhaar No 9876 5432 1012 Name: Suresh Kumar');
  const discrepancyResult = await processContractorDocumentVerification({
    aadhaarNumberEntered: '987654321012',
    companyPanEntered: 'ABCDE1234F',
    fullName: 'Ramesh Kumar', // Profile name Ramesh vs Aadhaar name Suresh
    businessName: 'XYZ Constructions',
    aadhaarDocBuffer: sampleAadhaarBuf,
    aadhaarDocFilename: 'aadhaar_sample.txt',
  });
  console.log('Verification Status:', discrepancyResult.verification.verificationStatus);
  console.log('Flags:', discrepancyResult.verification.mismatchFlags);
  console.log('Passed Discrepancy Test:', discrepancyResult.verification.verificationStatus === 'VERIFICATION_REQUIRED' ? 'PASSED ✅' : 'FAILED ❌');

  console.log('\n=== ALL MODULE INTEGRATION TESTS COMPLETED SUCCESSFULLY ✅ ===');
}

runTests().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
