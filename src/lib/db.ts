// In-memory / local storage "Database" for the MVP

export interface ComplaintRecord {
  id: string;
  originalText: string;
  area: string;
  utilityType: string;
  timeStarted: string;
  category: string;
  urgency: 'Low' | 'Medium' | 'High' | 'Emergency';
  generatedMessage: string;
  followUpMessage: string;
  status: 'New' | 'Reported' | 'Followed Up' | 'Resolved';
  timestamp: string; // ISO String
  reportCount?: number;
  verified?: boolean;
}

export interface UserNotification {
  id: string;
  complaintId: string;
  message: string;
  timestamp: string;
  read: boolean;
}

const STORAGE_KEY = 'ethiopia_utility_complaints';
const NOTIFICATIONS_KEY = 'ethiopia_utility_notifications';

export function getNotifications(): UserNotification[] {
  const data = localStorage.getItem(NOTIFICATIONS_KEY);
  if (!data) return [];
  try {
    return JSON.parse(data);
  } catch (e) {
    console.error("Failed to parse notifications.", e);
    return [];
  }
}

export function saveNotification(notification: UserNotification): void {
  const current = getNotifications();
  current.unshift(notification);
  localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(current));
  window.dispatchEvent(new Event('notifications_updated'));
}

export function markNotificationsAsRead(): void {
  const current = getNotifications();
  const updated = current.map(n => ({ ...n, read: true }));
  localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(updated));
  window.dispatchEvent(new Event('notifications_updated'));
}

export function getComplaints(): ComplaintRecord[] {
  const data = localStorage.getItem(STORAGE_KEY);
  if (!data) return [];
  try {
    return JSON.parse(data);
  } catch (e) {
    console.error("Failed to parse complaints from local storage.", e);
    return [];
  }
}

export function saveComplaint(complaint: ComplaintRecord): void {
  const current = getComplaints();
  current.unshift(complaint); // Add to beginning
  localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  
  // Dispatch a custom event so other components can update
  window.dispatchEvent(new Event('complaints_updated'));
}

export function updateComplaintStatus(id: string, status: ComplaintRecord['status']): void {
  const current = getComplaints();
  const index = current.findIndex(c => c.id === id);
  if (index !== -1) {
    current[index].status = status;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
    window.dispatchEvent(new Event('complaints_updated'));
  }
}

export function updateComplaintContent(id: string, generatedMessage: string, followUpMessage: string): void {
  const current = getComplaints();
  const index = current.findIndex(c => c.id === id);
  if (index !== -1) {
    current[index].generatedMessage = generatedMessage;
    current[index].followUpMessage = followUpMessage;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
    window.dispatchEvent(new Event('complaints_updated'));
  }
}

export function incrementReportCount(id: string): void {
  const current = getComplaints();
  const index = current.findIndex(c => c.id === id);
  if (index !== -1) {
    const count = (current[index].reportCount || 1) + 1;
    current[index].reportCount = count;
    
    if (count > 3) {
      current[index].verified = true;
      if (current[index].urgency === 'Low') {
        current[index].urgency = 'Medium';
      } else if (current[index].urgency === 'Medium') {
        current[index].urgency = 'High';
      }
    }
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
    window.dispatchEvent(new Event('complaints_updated'));
  }
}

export function getComplaintsByAreaAndType(area: string, utilityType: string) {
  const current = getComplaints();
  // Basic matching, ignoring case
  return current.filter(c => 
    c.area.toLowerCase() === area.toLowerCase() && 
    (c.utilityType === utilityType || c.category.includes(utilityType))
  );
}

// Seed some initial demo data if empty
export function seedDataIfEmpty() {
  const current = getComplaints();
  // Clean up any old demo data that was added previously
  const filtered = current.filter(c => !c.id.startsWith('demo-'));
  if (filtered.length !== current.length) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    window.dispatchEvent(new Event('complaints_updated'));
  }
}
