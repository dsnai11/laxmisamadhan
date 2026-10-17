// Demo accounts created by backend/prisma/seed.ts (plus setup.mjs for Team Lead and Viewer).
export const BASE_URL = process.env.TUTORIAL_BASE_URL || 'http://localhost:8003';

export const ACCOUNTS = {
  admin: { email: 'admin@ticketportal.local', password: process.env.ADMIN_PASSWORD || 'Admin@123456' },
  deptHead: { email: 'hardware.head@ticketportal.local', password: 'Head@123456' },
  teamLead: { email: 'lead.hardware@ticketportal.local', password: 'Lead@12345678' },
  agent: { email: 'agent.hardware@ticketportal.local', password: 'Agent@123456' },
  raiser: { email: 'john.doe@company.com', password: 'User@123456' },
  viewer: { email: 'viewer@company.com', password: 'View@12345678' },
};
