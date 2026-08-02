import type { Contractor, Project, Milestone, ChatMessage } from './types';

export const contractors: Contractor[] = [
  {
    id: 'c1',
    name: 'Rajesh Kumar',
    photo: 'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=150',
    rating: 4.8,
    reviews: 127,
    specialization: 'Plumbing',
    distance: '2.3 km',
    experience: '12 yrs',
    verified: true,
    matchScore: 96,
    quotedPrice: 18500,
    timeline: '3 days',
  },
  {
    id: 'c2',
    name: 'Priya Sharma',
    photo: 'https://images.pexels.com/photos/415829/pexels-photo-415829.jpeg?auto=compress&cs=tinysrgb&w=150',
    rating: 4.9,
    reviews: 203,
    specialization: 'Plumbing & Sanitary',
    distance: '3.8 km',
    experience: '15 yrs',
    verified: true,
    matchScore: 94,
    quotedPrice: 21000,
    timeline: '4 days',
  },
  {
    id: 'c3',
    name: 'Mohammed Ali',
    photo: 'https://images.pexels.com/photos/1222271/pexels-photo-1222271.jpeg?auto=compress&cs=tinysrgb&w=150',
    rating: 4.6,
    reviews: 89,
    specialization: 'Plumbing',
    distance: '5.1 km',
    experience: '8 yrs',
    verified: true,
    matchScore: 88,
    quotedPrice: 16500,
    timeline: '5 days',
  },
  {
    id: 'c4',
    name: 'Anita Verma',
    photo: 'https://images.pexels.com/photos/1239291/pexels-photo-1239291.jpeg?auto=compress&cs=tinysrgb&w=150',
    rating: 4.7,
    reviews: 156,
    specialization: 'Plumbing & Drainage',
    distance: '6.4 km',
    experience: '10 yrs',
    verified: false,
    matchScore: 82,
    quotedPrice: 14000,
    timeline: '6 days',
  },
];

export const projects: Project[] = [
  { id: 'p1', title: 'Kitchen Pipe Repair', status: 'In Progress', progress: 60, category: 'Plumbing' },
  { id: 'p2', title: 'Bathroom Renovation', status: 'Planning', progress: 15, category: 'Interior' },
  { id: 'p3', title: 'Living Room Painting', status: 'Completed', progress: 100, category: 'Painting' },
];

export const milestones: Milestone[] = [
  { id: 'm1', label: 'Site Inspection', status: 'completed', timestamp: '12 Jul 2026, 10:30 AM', note: 'Inspected kitchen pipes. Confirmed leakage in main supply line.', photo: 'https://images.pexels.com/photos/5828395/pexels-photo-5828395.jpeg?auto=compress&cs=tinysrgb&w=400' },
  { id: 'm2', label: 'Material Procurement', status: 'completed', timestamp: '14 Jul 2026, 2:00 PM', note: 'PVC pipes, fittings, and sealants procured from authorized supplier.' },
  { id: 'm3', label: 'Surface Preparation', status: 'completed', timestamp: '15 Jul 2026, 9:00 AM', note: 'Area cleared and old pipes removed. Ready for installation.' },
  { id: 'm4', label: 'Work in Progress', status: 'current', timestamp: 'In progress', note: 'Installing new PVC pipeline and connecting fixtures.' },
  { id: 'm5', label: 'Final Touch-up', status: 'upcoming' },
  { id: 'm6', label: 'Handover', status: 'upcoming' },
];

export const chatMessages: ChatMessage[] = [
  { id: '1', sender: 'contractor', text: 'Hi! I reviewed the site inspection report. We can start the pipe replacement tomorrow morning.', time: '10:30 AM' },
  { id: '2', sender: 'client', text: 'Great, what time will your team arrive?', time: '10:35 AM' },
  { id: '3', sender: 'contractor', text: 'We will be there by 9 AM with all materials. Should take about 4 hours.', time: '10:38 AM' },
  { id: '4', sender: 'client', text: 'Perfect. Do I need to clear anything from the kitchen?', time: '10:40 AM' },
  { id: '5', sender: 'contractor', text: 'Just move the items under the sink. Everything else we will handle.', time: '10:42 AM' },
];

export const conversations = [
  { id: '1', name: 'Rajesh Kumar', role: 'Plumbing Contractor', lastMsg: 'We will be there by 9 AM...', time: '10:42 AM', unread: 0, active: true },
  { id: '2', name: 'Priya Sharma', role: 'Interior Designer', lastMsg: 'Sent you the mood board for...', time: 'Yesterday', unread: 2, active: false },
  { id: '3', name: 'SmartBuild Support', role: 'Customer Care', lastMsg: 'Your project has been matched!', time: 'Mon', unread: 0, active: false },
];
