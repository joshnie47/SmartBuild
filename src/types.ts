export type Role = 'client' | 'contractor' | 'admin';

export type ScreenId =
  | 'auth'
  | 'client-home'
  | 'post-project'
  | 'contractor-results'
  | 'project-tracking'
  | 'review-dispute'
  | 'contractor-onboarding'
  | 'contractor-dashboard'
  | 'submit-quote'
  | 'project-update'
  | 'contractor-profile'
  | 'admin-dashboard'
  | 'chat';

export interface Contractor {
  id: string;
  name: string;
  photo: string;
  rating: number;
  reviews: number;
  specialization: string;
  distance: string;
  experience: string;
  verified: boolean;
  matchScore: number;
  quotedPrice: number;
  timeline: string;
}

export interface Project {
  id: string;
  title: string;
  status: 'Planning' | 'In Progress' | 'Completed' | 'Review';
  progress: number;
  category: string;
}

export interface Milestone {
  id: string;
  label: string;
  status: 'completed' | 'current' | 'upcoming';
  timestamp?: string;
  note?: string;
  photo?: string;
}

export interface ChatMessage {
  id: string;
  sender: 'client' | 'contractor';
  text: string;
  time: string;
}
