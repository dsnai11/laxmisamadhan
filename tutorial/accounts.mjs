// Demo accounts created by backend/prisma/seed.ts (plus setup.mjs for Team Lead and Viewer).
// setup.mjs also assigns each one the Employee ID used to sign in on screen.
export const BASE_URL = process.env.TUTORIAL_BASE_URL || 'http://localhost:8003';

export const ACCOUNTS = {
  admin: { employeeId: 'LIF10001', email: 'admin@ticketportal.local', password: process.env.ADMIN_PASSWORD || 'Admin@123456' },
  deptHead: { employeeId: 'LIF10002', email: 'hardware.head@ticketportal.local', password: 'Head@123456' },
  teamLead: { employeeId: 'LIF10003', email: 'lead.hardware@ticketportal.local', password: 'Lead@12345678' },
  agent: { employeeId: 'LIF10004', email: 'agent.hardware@ticketportal.local', password: 'Agent@123456' },
  raiser: { employeeId: 'LIF10234', email: 'john.doe@company.com', password: 'User@123456', defaultPassword: 'LaxmiUser@123' },
  viewer: { employeeId: 'LIF10235', email: 'viewer@company.com', password: 'View@12345678' },
};
