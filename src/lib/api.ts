import { getToken } from './auth';
import type {
  ApiContractorProfile,
  ApiBidItem,
  ApiNotificationItem,
  ApiReviewItem,
} from '../types';

const BASE = 'http://localhost:5000/api';

export interface ApiUser {
  _id: string;
  fullName: string;
  email?: string;
  phone?: string;
  role: 'CLIENT' | 'CONTRACTOR' | 'ADMIN';
  status: 'ACTIVE' | 'INACTIVE';
  onboardingCompleted?: boolean;
  kycStatus?: 'PENDING' | 'VERIFIED' | 'REJECTED';
  isVerified?: boolean;
  createdAt: string;
}

export interface AuthResponse {
  token: string;
  user: ApiUser;
}

export interface ApiProjectMilestone {
  id: string;
  label: string;
  status: 'completed' | 'current' | 'upcoming';
  timestamp?: string;
  note?: string;
  photo?: string;
}

export interface ApiProject {
  _id: string;
  title: string;
  description: string;
  category: string;
  budget: number;
  timeline: string;
  location: string;
  houseNo?: string;
  streetArea?: string;
  clientId: string | { _id: string; fullName: string; phone?: string; email?: string };
  selectedContractorId?: string | { _id: string; fullName: string; specialization?: string; phone?: string; averageRating?: number; completedProjects?: number; isVerified?: boolean };
  selectedBidId?: string | ApiBidItem;
  status: 'OPEN' | 'IN_PROGRESS' | 'PENDING_VERIFICATION' | 'COMPLETED' | 'CANCELLED';
  imageUrls: string[];
  pdfUrl?: string | null;
  milestones: ApiProjectMilestone[];
  delayFlag?: { flagged: boolean; reason?: string; note?: string; flaggedAt?: string };
  bidsCount?: number;
  createdAt: string;
}

export interface ApiContractor {
  _id: string;
  fullName: string;
  specialization?: string;
  averageRating: number;
  completedProjects: number;
  isVerified: boolean;
  isAvailable: boolean;
  city?: string;
  experienceYears?: number;
}

export interface ContractorDashboardStats {
  fullName: string;
  kycStatus: 'PENDING' | 'VERIFIED' | 'REJECTED';
  isVerified: boolean;
  isAvailable: boolean;
  rating: number;
  totalReviews: number;
  completedJobs: number;
  activeJobs: number;
  submittedBidsCount: number;
  earnings: number;
  openOpportunities: ApiProject[];
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const { headers: extraHeaders, ...restOptions } = options ?? {};
  const res = await fetch(`${BASE}${path}`, {
    ...restOptions,
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Something went wrong.');
  return data as T;
}

// ── Auth APIs ────────────────────────────────────────────────────────────────
export async function apiPhoneCheck(phone: string, role?: string): Promise<{ exists: boolean; hasPin: boolean; role?: string; roleMismatch?: boolean; expectedRoleName?: string }> {
  return request<{ exists: boolean; hasPin: boolean; role?: string; roleMismatch?: boolean; expectedRoleName?: string }>('/auth/phone-check', {
    method: 'POST',
    body: JSON.stringify({ phone, role }),
  });
}

export async function apiPhoneLogin(payload: { phone: string; pin: string; role?: string }): Promise<{ token: string; user: ApiUser }> {
  return request<{ token: string; user: ApiUser }>('/auth/phone-login', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function apiPhoneRegister(payload: {
  fullName: string;
  phone: string;
  role: string;
  pin: string;
}): Promise<{ token: string; user: ApiUser }> {
  return request<{ token: string; user: ApiUser }>('/auth/phone-register', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function apiPhoneSetupPin(payload: { phone: string; pin: string; role?: string }): Promise<{ token: string; user: ApiUser }> {
  return request<{ token: string; user: ApiUser }>('/auth/phone-setup-pin', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function apiRegister(payload: {
  fullName: string;
  email: string;
  password: string;
  phone?: string;
  role: 'CLIENT' | 'CONTRACTOR';
}): Promise<AuthResponse> {
  return request<AuthResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function apiLogin(email: string, password: string, role?: string): Promise<AuthResponse> {
  return request<AuthResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password, role }),
  });
}

export async function apiGetMe(): Promise<ApiUser> {
  const token = getToken();
  if (!token) throw new Error('No token');
  const data = await request<{ user: ApiUser }>('/auth/me', {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data.user;
}

// ── Project APIs ─────────────────────────────────────────────────────────────
export async function apiDetectCategory(title: string, description: string): Promise<string> {
  const data = await request<{ category: string }>('/projects/detect-category', {
    method: 'POST',
    body: JSON.stringify({ title, description }),
  });
  return data.category;
}

export async function apiGetMyProjects(): Promise<ApiProject[]> {
  const token = getToken();
  if (!token) throw new Error('Not authenticated.');
  const data = await request<{ projects: ApiProject[] }>('/projects', {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data.projects;
}

export const apiGetProjects = apiGetMyProjects;

export async function apiGetAvailableProjectsFeed(): Promise<ApiProject[]> {
  const token = getToken();
  if (!token) throw new Error('Not authenticated.');
  const data = await request<{ projects: ApiProject[] }>('/projects/feed', {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data.projects;
}

export const apiGetProjectFeed = async (): Promise<{ projects: ApiProject[] }> => {
  try {
    const list = await apiGetAvailableProjectsFeed();
    return { projects: list };
  } catch {
    return { projects: [] };
  }
};

export async function apiGetContractorMyProjects(): Promise<ApiProject[]> {
  const token = getToken();
  if (!token) throw new Error('Not authenticated.');
  const data = await request<{ projects: ApiProject[] }>('/projects/contractor/my-projects', {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data.projects;
}

export async function apiGetProjectById(id: string): Promise<{ project: ApiProject; bidsCount: number; myBid?: ApiBidItem | null }> {
  const token = getToken();
  if (!token) throw new Error('Not authenticated.');
  return request<{ project: ApiProject; bidsCount: number; myBid?: ApiBidItem | null }>(`/projects/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function apiUploadFiles(images: File[], pdf: File | null): Promise<{ imageUrls: string[]; pdfUrl: string | null }> {
  const token = getToken();
  if (!token) throw new Error('Not authenticated.');
  const form = new FormData();
  images.forEach((img) => form.append('images', img));
  if (pdf) form.append('pdf', pdf);
  const res = await fetch(`${BASE}/projects/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Upload failed.');
  return data as { imageUrls: string[]; pdfUrl: string | null };
}

export async function apiPostProject(payload: {
  title: string;
  description: string;
  category: string;
  budget: number;
  timeline: string;
  location: string;
  houseNo?: string;
  streetArea?: string;
  imageUrls?: string[];
  pdfUrl?: string | null;
}): Promise<ApiProject> {
  const token = getToken();
  if (!token) throw new Error('Not authenticated.');
  const data = await request<{ project: ApiProject }>('/projects', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  return data.project;
}

export async function apiGetProjectStats(): Promise<{ activeProjects: number }> {
  const token = getToken();
  if (!token) throw new Error('Not authenticated.');
  return request<{ activeProjects: number }>('/projects/stats', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function apiSelectContractor(
  projectId: string,
  contractorIdOrBidId: string,
  contractorId?: string
): Promise<{ project: ApiProject }> {
  const token = getToken();
  if (!token) throw new Error('Not authenticated.');
  const body = contractorId
    ? { bidId: contractorIdOrBidId, contractorId }
    : { contractorId: contractorIdOrBidId };
  return request<{ project: ApiProject }>(`/projects/${projectId}/select-contractor`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
}

export async function apiUpdateMilestone(
  projectId: string,
  milestoneIdOrPayload: string | { milestoneId: string; status: string; note?: string; photo?: string },
  status?: string,
  note?: string,
  photo?: string
): Promise<{ project: ApiProject }> {
  const token = getToken();
  if (!token) throw new Error('Not authenticated.');
  const body =
    typeof milestoneIdOrPayload === 'string'
      ? { milestoneId: milestoneIdOrPayload, status, note, photo }
      : milestoneIdOrPayload;
  return request<{ project: ApiProject }>(`/projects/${projectId}/milestone`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
}

export async function apiFlagDelay(projectId: string, reason: string, note?: string): Promise<{ project: ApiProject }> {
  const token = getToken();
  if (!token) throw new Error('Not authenticated.');
  return request<{ project: ApiProject }>(`/projects/${projectId}/flag-delay`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ reason, note }),
  });
}

export async function apiContractorMarkComplete(projectId: string): Promise<{ project: ApiProject }> {
  const token = getToken();
  if (!token) throw new Error('Not authenticated.');
  return request<{ project: ApiProject }>(`/projects/${projectId}/contractor-complete`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function apiVerifyProjectCompletion(projectId: string): Promise<{ project: ApiProject }> {
  const token = getToken();
  if (!token) throw new Error('Not authenticated.');
  return request<{ project: ApiProject }>(`/projects/${projectId}/verify-completion`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
}

// ── Contractor APIs ──────────────────────────────────────────────────────────
export async function apiGetContractors(): Promise<ApiContractor[]> {
  const data = await request<{ contractors: ApiContractor[] }>('/contractors');
  return data.contractors;
}

export async function apiGetContractorProfileMe(): Promise<{
  profile: ApiContractorProfile | null;
  onboardingCompleted: boolean;
  kycStatus: 'PENDING' | 'VERIFIED' | 'REJECTED';
  fullName: string;
  phone?: string;
  email?: string;
}> {
  const token = getToken();
  if (!token) throw new Error('Not authenticated.');
  return request('/contractors/profile/me', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function apiSaveContractorProfile(payload: {
  fullName?: string;
  businessName?: string;
  primaryTrade: string;
  specializations: string[];
  experienceYears: number;
  licenseNo?: string;
  city: string;
  serviceAreas: string[];
  about?: string;
  teamSize: number;
  kycDocumentType?: string;
  kycDocumentNumber?: string;
  kycDocumentUrls?: string[];
}): Promise<{ profile: ApiContractorProfile; onboardingCompleted: boolean }> {
  const token = getToken();
  if (!token) throw new Error('Not authenticated.');
  return request('/contractors/profile', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
}

export async function apiUpdateContractorProfile(payload: {
  fullName?: string;
  businessName?: string;
  primaryTrade?: string;
  specializations?: string[];
  experienceYears?: number;
  licenseNo?: string;
  city?: string;
  serviceAreas?: string[];
  about?: string;
  teamSize?: number;
  isAvailable?: boolean;
  portfolioImages?: string[];
}): Promise<{ profile: ApiContractorProfile }> {
  const token = getToken();
  if (!token) throw new Error('Not authenticated.');
  return request('/contractors/profile', {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
}

export async function apiGetContractorDashboardStats(): Promise<ContractorDashboardStats> {
  const token = getToken();
  if (!token) throw new Error('Not authenticated.');
  return request<ContractorDashboardStats>('/contractors/dashboard/stats', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function apiGetContractorPublicProfile(id: string): Promise<{ contractor: ApiContractorProfile }> {
  return request<{ contractor: ApiContractorProfile }>(`/contractors/profile/${id}`);
}

// ── Bids APIs ────────────────────────────────────────────────────────────────
export async function apiSubmitBid(payload: {
  projectId: string;
  amount: number;
  estimatedDays: number;
  materialsIncluded?: boolean;
  warranty?: string;
  proposalMessage?: string;
  availabilityDate?: string;
}): Promise<{ bid: ApiBidItem; message: string }> {
  const token = getToken();
  if (!token) throw new Error('Not authenticated.');
  return request('/bids', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
}

export async function apiGetMyBids(): Promise<{ bids: ApiBidItem[] }> {
  const token = getToken();
  if (!token) throw new Error('Not authenticated.');
  return request('/bids/my-bids', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function apiGetProjectBids(projectId: string): Promise<{ bids: ApiBidItem[]; project: ApiProject }> {
  const token = getToken();
  if (!token) throw new Error('Not authenticated.');
  return request(`/bids/project/${projectId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function apiAcceptBid(bidId: string): Promise<{ message: string; bid: ApiBidItem; project: ApiProject }> {
  const token = getToken();
  if (!token) throw new Error('Not authenticated.');
  return request(`/bids/${bidId}/accept`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function apiRejectBid(bidId: string): Promise<{ message: string; bid: ApiBidItem }> {
  const token = getToken();
  if (!token) throw new Error('Not authenticated.');
  return request(`/bids/${bidId}/reject`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
}

// ── Review APIs ──────────────────────────────────────────────────────────────
export async function apiSubmitReview(payload: {
  projectId: string;
  rating: number;
  reviewText?: string;
  tags?: string[];
}): Promise<{ review: ApiReviewItem; contractorRating: number }> {
  const token = getToken();
  if (!token) throw new Error('Not authenticated.');
  return request('/reviews', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
}

export async function apiGetContractorReviews(contractorId: string): Promise<{ reviews: ApiReviewItem[] }> {
  return request(`/reviews/contractor/${contractorId}`);
}

// ── Notification APIs ────────────────────────────────────────────────────────
export async function apiGetNotifications(): Promise<{ notifications: ApiNotificationItem[]; unreadCount: number }> {
  const token = getToken();
  if (!token) throw new Error('Not authenticated.');
  return request('/notifications', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function apiMarkNotificationRead(id: string): Promise<{ notification: ApiNotificationItem }> {
  const token = getToken();
  if (!token) throw new Error('Not authenticated.');
  return request(`/notifications/${id}/read`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function apiMarkAllNotificationsRead(): Promise<{ message: string }> {
  const token = getToken();
  if (!token) throw new Error('Not authenticated.');
  return request('/notifications/read-all', {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
  });
}

// ── Admin APIs ───────────────────────────────────────────────────────────────
export interface AdminContractorItem {
  _id: string;
  fullName: string;
  email?: string;
  phone?: string;
  trade: string;
  specializations?: string[];
  experienceYears?: number;
  licenseNo?: string;
  city?: string;
  serviceAreas?: string[];
  kycStatus: 'PENDING' | 'VERIFIED' | 'REJECTED';
  kycDocumentType?: string;
  kycDocumentNumber?: string;
  kycDocumentUrls?: string[];
  isVerified: boolean;
  averageRating?: number;
  completedProjects?: number;
  createdAt?: string;
}

export async function apiAdminGetContractors(): Promise<{ contractors: AdminContractorItem[] }> {
  return request('/admin/contractors');
}

export async function apiGetAdminContractors(): Promise<AdminContractorItem[]> {
  try {
    const res = await apiAdminGetContractors();
    return res.contractors || [];
  } catch {
    return [];
  }
}

export async function apiAdminVerifyContractor(id: string, status: 'VERIFIED' | 'REJECTED' | 'PENDING'): Promise<{ message: string }> {
  return request(`/admin/contractors/${id}/verify`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

export async function apiAdminDeleteContractor(id: string): Promise<{ message: string }> {
  return request(`/admin/contractors/${id}`, {
    method: 'DELETE',
  });
}

export async function apiAdminDeleteProject(id: string): Promise<{ message: string }> {
  return request(`/admin/projects/${id}`, {
    method: 'DELETE',
  });
}

export async function apiAdminGetProjects(): Promise<{ projects: ApiProject[] }> {
  return request('/admin/projects');
}

export async function apiAdminGetAllData(): Promise<any> {
  return request('/admin/all-data');
}

export async function apiAdminGetStats(): Promise<{
  totalClients: number;
  totalContractors: number;
  pendingVerifications: number;
  activeProjects: number;
  completedProjects: number;
}> {
  return request('/admin/stats');
}
