import { IProjectMilestone } from '../models/Project';

/**
 * Generate category-tailored project tracking stages for SmartBuild.
 * The FIRST stage is ALWAYS "Site Visit" (status: 'current').
 */
export function getCategoryStages(category: string): IProjectMilestone[] {
  const cat = (category || '').toLowerCase().trim();

  if (cat.includes('plumb')) {
    return [
      { id: 'm1', label: 'Site Visit & Inspection', status: 'current', note: 'Project initialized. Initial site visit and pipe routing assessment.' },
      { id: 'm2', label: 'Material Procurement & Setup', status: 'upcoming' },
      { id: 'm3', label: 'Pipe Fitting & Core Work', status: 'upcoming' },
      { id: 'm4', label: 'Pressure & Leakage Testing', status: 'upcoming' },
      { id: 'm5', label: 'Final Handover & Verification', status: 'upcoming' },
    ];
  }

  if (cat.includes('electr')) {
    return [
      { id: 'm1', label: 'Site Visit & Load Assessment', status: 'current', note: 'Project initialized. Initial site visit and electrical circuit planning.' },
      { id: 'm2', label: 'Wiring & Conduit Installation', status: 'upcoming' },
      { id: 'm3', label: 'Switchboard & Component Setup', status: 'upcoming' },
      { id: 'm4', label: 'Safety & Earthing Inspection', status: 'upcoming' },
      { id: 'm5', label: 'Final Handover & Verification', status: 'upcoming' },
    ];
  }

  if (cat.includes('paint') || cat.includes('decor')) {
    return [
      { id: 'm1', label: 'Site Visit & Surface Measurement', status: 'current', note: 'Project initialized. Initial site visit and wall condition evaluation.' },
      { id: 'm2', label: 'Surface Prep & Primer Coating', status: 'upcoming' },
      { id: 'm3', label: 'Primary Paint / Finish Application', status: 'upcoming' },
      { id: 'm4', label: 'Touchups & Quality Inspection', status: 'upcoming' },
      { id: 'm5', label: 'Final Handover & Cleanup', status: 'upcoming' },
    ];
  }

  if (cat.includes('interior') || cat.includes('carpent')) {
    return [
      { id: 'm1', label: 'Site Visit & Measurements', status: 'current', note: 'Project initialized. Initial site visit and spatial measurements.' },
      { id: 'm2', label: '3D Design & Material Approval', status: 'upcoming' },
      { id: 'm3', label: 'Woodwork & Modular Assembly', status: 'upcoming' },
      { id: 'm4', label: 'Fittings & Polish', status: 'upcoming' },
      { id: 'm5', label: 'Final Handover & Inspection', status: 'upcoming' },
    ];
  }

  // Default / Construction / Civil / Structural Work
  return [
    { id: 'm1', label: 'Site Visit & Initial Setup', status: 'current', note: 'Project initialized. Site inspection and layout marking.' },
    { id: 'm2', label: 'Planning & Material Procurement', status: 'upcoming' },
    { id: 'm3', label: 'Foundation & Structural Work', status: 'upcoming' },
    { id: 'm4', label: 'Electrical & Plumbing Layout', status: 'upcoming' },
    { id: 'm5', label: 'Finishing & Tile Work', status: 'upcoming' },
    { id: 'm6', label: 'Final Inspection & Handover', status: 'upcoming' },
  ];
}
