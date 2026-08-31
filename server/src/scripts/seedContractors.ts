import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'path';
import { User } from '../models/User';
import { ContractorProfile } from '../models/ContractorProfile';
import { Project } from '../models/Project';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/smartbuild';

const contractorsData = [
  {
    fullName: 'Arun Kumar',
    email: 'aruncivil@smartbuild.in',
    phone: '+919876500001',
    businessName: 'Arun Civil Works & Builders',
    primaryTrade: 'Civil Construction',
    specializations: ['Civil Construction', 'Residential Construction', 'Masonry', 'Structural Work'],
    experienceYears: 15,
    licenseNo: 'TN-CBE-CIVIL-2011',
    city: 'Coimbatore',
    serviceAreas: ['RS Puram', 'Gandhipuram', 'Peelamedu', 'Coimbatore'],
    about: 'Leading civil contractor with 15+ years of experience in Coimbatore constructing residential and commercial foundations, RCC structures, and turnkey buildings.',
    teamSize: 18,
    averageRating: 4.9,
    totalReviews: 142,
    completedProjects: 89,
    portfolioImages: [
      'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=200',
      'https://images.pexels.com/photos/5828395/pexels-photo-5828395.jpeg?auto=compress&cs=tinysrgb&w=400',
    ],
  },
  {
    fullName: 'Ravi Chandran',
    email: 'ravielectricals@smartbuild.in',
    phone: '+919876500002',
    businessName: 'Ravi Electricals & Power Solutions',
    primaryTrade: 'Electrical',
    specializations: ['Electrical', '3-Phase Industrial Wiring', 'Home Automation', 'Solar Installation'],
    experienceYears: 12,
    licenseNo: 'TN-CBE-ELEC-2014',
    city: 'Coimbatore',
    serviceAreas: ['Gandhipuram', 'Peelamedu', 'Singanallur', 'Saravanampatti'],
    about: 'Certified Master Electrician specializing in complete residential rewiring, industrial 3-phase panels, safety grounding, and smart lighting systems.',
    teamSize: 8,
    averageRating: 4.8,
    totalReviews: 98,
    completedProjects: 65,
    portfolioImages: [
      'https://images.pexels.com/photos/1222271/pexels-photo-1222271.jpeg?auto=compress&cs=tinysrgb&w=200',
      'https://images.pexels.com/photos/8961065/pexels-photo-8961065.jpeg?auto=compress&cs=tinysrgb&w=400',
    ],
  },
  {
    fullName: 'Suresh Mani',
    email: 'sureshplumbing@smartbuild.in',
    phone: '+919876500003',
    businessName: 'Suresh Plumbing & Waterproofing',
    primaryTrade: 'Plumbing',
    specializations: ['Plumbing', 'Waterproofing', 'Drainage', 'Pipe Fitting', 'Sanitary Work'],
    experienceYears: 10,
    licenseNo: 'TN-CBE-PLUMB-2016',
    city: 'Coimbatore',
    serviceAreas: ['Peelamedu', 'RS Puram', 'Kovaipudur', 'Sundarapuram'],
    about: 'Expert plumbing contractor solving complex leakages, bathroom sanitary fittings, pressure pumps, and terrace membrane waterproofing.',
    teamSize: 6,
    averageRating: 4.7,
    totalReviews: 76,
    completedProjects: 48,
    portfolioImages: [
      'https://images.pexels.com/photos/2379004/pexels-photo-2379004.jpeg?auto=compress&cs=tinysrgb&w=200',
      'https://images.pexels.com/photos/5828395/pexels-photo-5828395.jpeg?auto=compress&cs=tinysrgb&w=400',
    ],
  },
  {
    fullName: 'Karthik Raja',
    email: 'karthikinteriors@smartbuild.in',
    phone: '+919876500004',
    businessName: 'Karthik Interiors & Woodcraft',
    primaryTrade: 'Interior Design',
    specializations: ['Interior Design', 'Carpentry', 'Modular Kitchen', 'False Ceiling', 'Flooring'],
    experienceYears: 8,
    licenseNo: 'TN-CBE-INT-2018',
    city: 'Coimbatore',
    serviceAreas: ['Saravanampatti', 'RS Puram', 'Gandhipuram', 'Peelamedu'],
    about: 'Creative interior designer providing modular kitchen design, custom teakwood carpentry, gypsum false ceilings, and ambient lighting.',
    teamSize: 10,
    averageRating: 4.9,
    totalReviews: 84,
    completedProjects: 52,
    portfolioImages: [
      'https://images.pexels.com/photos/614810/pexels-photo-614810.jpeg?auto=compress&cs=tinysrgb&w=200',
      'https://images.pexels.com/photos/8961065/pexels-photo-8961065.jpeg?auto=compress&cs=tinysrgb&w=400',
    ],
  },
  {
    fullName: 'Mani Velu',
    email: 'maniroofing@smartbuild.in',
    phone: '+919876500005',
    businessName: 'Mani Roofing & Waterproofing Works',
    primaryTrade: 'Roofing',
    specializations: ['Roofing', 'Waterproofing', 'Structural Steel', 'PU Coating', 'Rainwater Harvesting'],
    experienceYears: 14,
    licenseNo: 'TN-CBE-ROOF-2012',
    city: 'Coimbatore',
    serviceAreas: ['Singanallur', 'Sundarapuram', 'RS Puram', 'Gandhipuram'],
    about: 'Specialized in metal sheet roofing, truss fabrication, terrace leakage crack filling, and elastomeric waterproofing.',
    teamSize: 12,
    averageRating: 4.8,
    totalReviews: 65,
    completedProjects: 44,
    portfolioImages: [
      'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=200',
      'https://images.pexels.com/photos/5828395/pexels-photo-5828395.jpeg?auto=compress&cs=tinysrgb&w=400',
    ],
  },
];

async function seed() {
  try {
    console.log('Connecting to MongoDB:', MONGODB_URI);
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB.');

    const defaultPinHash = await bcrypt.hash('123456', 10);
    const defaultPassword = await bcrypt.hash('Password@123', 10);

    for (const c of contractorsData) {
      let user = await User.findOne({ phone: c.phone });
      if (!user) {
        user = await User.create({
          fullName: c.fullName,
          email: c.email,
          phone: c.phone,
          password: defaultPassword,
          pinHash: defaultPinHash,
          role: 'CONTRACTOR',
          status: 'ACTIVE',
          kycStatus: 'VERIFIED',
          isVerified: true,
          specialization: c.primaryTrade,
          averageRating: c.averageRating,
          completedProjects: c.completedProjects,
          onboardingCompleted: true,
        });
        console.log(`Created contractor user: ${c.fullName} (${c.phone})`);
      } else {
        user.kycStatus = 'VERIFIED';
        user.isVerified = true;
        user.specialization = c.primaryTrade;
        user.onboardingCompleted = true;
        await user.save();
        console.log(`Updated contractor user: ${c.fullName}`);
      }

      await ContractorProfile.findOneAndUpdate(
        { userId: user._id },
        {
          userId: user._id,
          fullName: c.fullName,
          email: c.email,
          phone: c.phone,
          businessName: c.businessName,
          primaryTrade: c.primaryTrade,
          specializations: c.specializations,
          experienceYears: c.experienceYears,
          licenseNo: c.licenseNo,
          city: c.city,
          serviceAreas: c.serviceAreas,
          about: c.about,
          teamSize: c.teamSize,
          kycStatus: 'VERIFIED',
          kycDocumentType: 'Aadhaar Card',
          kycDocumentNumber: '5432-8765-9012',
          kycDocumentUrls: [
            'https://images.pexels.com/photos/5828395/pexels-photo-5828395.jpeg?auto=compress&cs=tinysrgb&w=400',
          ],
          portfolioImages: c.portfolioImages,
          isAvailable: true,
          averageRating: c.averageRating,
          totalReviews: c.totalReviews,
          completedProjects: c.completedProjects,
          onboardingCompleted: true,
        },
        { upsert: true, new: true }
      );
      console.log(`Synced ContractorProfile for: ${c.fullName}`);
    }

    console.log('✅ Seeding completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Seeding error:', err);
    process.exit(1);
  }
}

seed();
