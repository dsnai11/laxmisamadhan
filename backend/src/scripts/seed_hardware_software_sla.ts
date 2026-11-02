import { PrismaClient, TicketCategory, TicketPriority } from '@prisma/client';

const prisma = new PrismaClient();

export const HARDWARE_SLA_MATRIX = [
  {
    subCategory: 'Desktop',
    subIssue: 'Desktop / PC not working',
    priority: TicketPriority.CRITICAL,
    priorityLabel: 'P1 – Critical',
    responseTimeMins: 15,
    resolutionTimeMins: 240, // 4 hours
    description: 'Business-critical PC failure stopping work',
  },
  {
    subCategory: 'Laptop',
    subIssue: 'Laptop not starting',
    priority: TicketPriority.HIGH,
    priorityLabel: 'P2 – High',
    responseTimeMins: 30,
    resolutionTimeMins: 240, // 4 hours
    description: 'One user essential laptop work blocked',
  },
  {
    subCategory: 'Peripheral',
    subIssue: 'Keyboard / Mouse not working',
    priority: TicketPriority.MEDIUM,
    priorityLabel: 'P3 – Medium',
    responseTimeMins: 60,
    resolutionTimeMins: 480, // 8 hours
    description: 'Input device failure with potential temporary workaround',
  },
  {
    subCategory: 'Monitor / Display',
    subIssue: 'Monitor / Display issue',
    priority: TicketPriority.HIGH,
    priorityLabel: 'P2 – High',
    responseTimeMins: 30,
    resolutionTimeMins: 240, // 4 hours
    description: 'Display output / monitor blank or flickering',
  },
  {
    subCategory: 'Printer',
    subIssue: 'Printer not working – critical department',
    priority: TicketPriority.CRITICAL,
    priorityLabel: 'P1 – Critical',
    responseTimeMins: 15,
    resolutionTimeMins: 120, // 2 hours
    description: 'Disbursal / Cash / Legal printing blocked in critical department',
  },
  {
    subCategory: 'Printer',
    subIssue: 'Printer not working – normal user',
    priority: TicketPriority.MEDIUM,
    priorityLabel: 'P3 – Medium',
    responseTimeMins: 60,
    resolutionTimeMins: 480, // 8 hours
    description: 'General user printing issue',
  },
  {
    subCategory: 'Network Hardware',
    subIssue: 'Network cable / LAN port hardware issue',
    priority: TicketPriority.HIGH,
    priorityLabel: 'P2 – High',
    responseTimeMins: 30,
    resolutionTimeMins: 240, // 4 hours
    description: 'Physical LAN / Cable / Port connectivity broken',
  },
  {
    subCategory: 'Peripheral',
    subIssue: 'Docking station / Adapter issue',
    priority: TicketPriority.MEDIUM,
    priorityLabel: 'P3 – Medium',
    responseTimeMins: 60,
    resolutionTimeMins: 480, // 8 hours
    description: 'Docking station or power adapter connectivity problem',
  },
  {
    subCategory: 'Power / UPS',
    subIssue: 'UPS / Power backup issue',
    priority: TicketPriority.HIGH,
    priorityLabel: 'P2 – High',
    responseTimeMins: 30,
    resolutionTimeMins: 240, // 4 hours
    description: 'UPS or power backup failure risking data loss / outage',
  },
  {
    subCategory: 'Desktop',
    subIssue: 'Hardware overheating / Fan noise',
    priority: TicketPriority.HIGH,
    priorityLabel: 'P2 – High',
    responseTimeMins: 30,
    resolutionTimeMins: 240, // 4 hours
    description: 'Excessive thermal heating or cooling fan malfunction',
  },
  {
    subCategory: 'Desktop',
    subIssue: 'RAM / HDD / SSD failure',
    priority: TicketPriority.HIGH,
    priorityLabel: 'P2 – High',
    responseTimeMins: 30,
    resolutionTimeMins: 480, // 4-8 hours
    description: 'Storage or memory hardware crash / bad sectors',
  },
  {
    subCategory: 'Desktop',
    subIssue: 'Blue screen / Hardware crash',
    priority: TicketPriority.HIGH,
    priorityLabel: 'P2 – High',
    responseTimeMins: 30,
    resolutionTimeMins: 240, // 4 hours
    description: 'BSOD / Kernel hardware trap failure',
  },
  {
    subCategory: 'Peripheral',
    subIssue: 'Webcam / Microphone hardware issue',
    priority: TicketPriority.MEDIUM,
    priorityLabel: 'P3 – Medium',
    responseTimeMins: 60,
    resolutionTimeMins: 480, // 8 hours
    description: 'Audio / Video recording or conference hardware problem',
  },
  {
    subCategory: 'Laptop',
    subIssue: 'Laptop battery issue',
    priority: TicketPriority.MEDIUM,
    priorityLabel: 'P3 – Medium',
    responseTimeMins: 60,
    resolutionTimeMins: 480, // 1 business day (8 business hours)
    description: 'Battery health critical / rapid discharge',
  },
  {
    subCategory: 'Laptop',
    subIssue: 'Physical damage to device',
    priority: TicketPriority.MEDIUM,
    priorityLabel: 'P3 – Medium',
    responseTimeMins: 120, // 2 hours
    resolutionTimeMins: 1440, // 1-3 business days
    description: 'Chassis / Screen / Hinge physical crack or drop damage',
  },
  {
    subCategory: 'Hardware Procurement & Installation',
    subIssue: 'New hardware installation',
    priority: TicketPriority.LOW,
    priorityLabel: 'P4 – Low',
    responseTimeMins: 240, // 4 business hours
    resolutionTimeMins: 2880, // 2-3 business days
    description: 'Planned installation and configuration of new equipment',
  },
  {
    subCategory: 'Hardware Replacement',
    subIssue: 'Hardware replacement request',
    priority: TicketPriority.MEDIUM,
    priorityLabel: 'P3 – Medium',
    responseTimeMins: 60,
    resolutionTimeMins: 1440, // 1-3 business days
    description: 'Replacement of end-of-life or damaged hardware',
  },
  {
    subCategory: 'Warranty & OEM Support',
    subIssue: 'Warranty / OEM service coordination',
    priority: TicketPriority.MEDIUM,
    priorityLabel: 'P3 – Medium',
    responseTimeMins: 120, // 2 hours
    resolutionTimeMins: 4320, // 3-5 business days
    description: 'OEM vendor on-site service call and part procurement',
  },
  {
    subCategory: 'Asset Management',
    subIssue: 'Hardware inventory / Asset tagging',
    priority: TicketPriority.LOW,
    priorityLabel: 'P4 – Low',
    responseTimeMins: 240, // 4 business hours
    resolutionTimeMins: 2880, // 2 business days
    description: 'Physical audit and barcode/QR asset tagging',
  },
  {
    subCategory: 'Peripheral',
    subIssue: 'Peripheral / USB port issue',
    priority: TicketPriority.MEDIUM,
    priorityLabel: 'P3 – Medium',
    responseTimeMins: 60,
    resolutionTimeMins: 480, // 8 hours
    description: 'Faulty USB connector or external peripheral device',
  },
];

export const SOFTWARE_SLA_MATRIX = [
  {
    subCategory: 'LOS (Loan Origination System)',
    subIssue: 'LOS Application Down / Critical Error',
    priority: TicketPriority.CRITICAL,
    priorityLabel: 'P1 – Critical',
    responseTimeMins: 15,
    resolutionTimeMins: 120, // 2 hours
    description: 'Core lending LOS portal unavailable or customer application stuck',
  },
  {
    subCategory: 'LMS (Loan Management System)',
    subIssue: 'LMS Repayment / Disbursal Posting Error',
    priority: TicketPriority.CRITICAL,
    priorityLabel: 'P1 – Critical',
    responseTimeMins: 15,
    resolutionTimeMins: 120, // 2 hours
    description: 'Loan disbursal or EMI repayment transaction failure in LMS',
  },
  {
    subCategory: 'CLU-collection',
    subIssue: 'CLU Collection App / Receipt Sync Issue',
    priority: TicketPriority.CRITICAL,
    priorityLabel: 'P1 – Critical',
    responseTimeMins: 15,
    resolutionTimeMins: 120, // 2 hours
    description: 'Collection agent mobile receipt generation or banking sync failure',
  },
  {
    subCategory: 'Core Applications',
    subIssue: 'Core Banking / Payment Gateway Sync Failure',
    priority: TicketPriority.CRITICAL,
    priorityLabel: 'P1 – Critical',
    responseTimeMins: 15,
    resolutionTimeMins: 120, // 2 hours
    description: 'Integration failure with banking partner or payment gateway',
  },
  {
    subCategory: 'CRM',
    subIssue: 'CRM Customer Lead / KYC Processing Error',
    priority: TicketPriority.HIGH,
    priorityLabel: 'P2 – High',
    responseTimeMins: 30,
    resolutionTimeMins: 240, // 4 hours
    description: 'KYC validation or lead allocation failure in CRM',
  },
  {
    subCategory: 'Operating System & Drivers',
    subIssue: 'Operating System / Blue Screen / Corrupted OS',
    priority: TicketPriority.HIGH,
    priorityLabel: 'P2 – High',
    responseTimeMins: 30,
    resolutionTimeMins: 240, // 4 hours
    description: 'OS corruption, BitLocker lock, or system software failure',
  },
  {
    subCategory: 'Productivity Software',
    subIssue: 'Email / Outlook Access / Exchange Connection Issue',
    priority: TicketPriority.HIGH,
    priorityLabel: 'P2 – High',
    responseTimeMins: 30,
    resolutionTimeMins: 240, // 4 hours
    description: 'Corporate email or MS Outlook communication down for user',
  },
  {
    subCategory: 'Browser & Portals',
    subIssue: 'Digital Signature (DSC) / Java / Browser Certificate Error',
    priority: TicketPriority.HIGH,
    priorityLabel: 'P2 – High',
    responseTimeMins: 30,
    resolutionTimeMins: 240, // 4 hours
    description: 'Class 3 DSC token, Java runtime, or banking portal certificate issue',
  },
  {
    subCategory: 'Security Software',
    subIssue: 'Antivirus / Security Patch Installation Failure',
    priority: TicketPriority.HIGH,
    priorityLabel: 'P2 – High',
    responseTimeMins: 30,
    resolutionTimeMins: 240, // 4 hours
    description: 'EDR / Antivirus agent broken or mandatory security update failed',
  },
  {
    subCategory: 'Software Licenses',
    subIssue: 'Software License Allocation (MS Office, Adobe, etc.)',
    priority: TicketPriority.MEDIUM,
    priorityLabel: 'P3 – Medium',
    responseTimeMins: 60,
    resolutionTimeMins: 480, // 8 hours
    description: 'Provisioning or license key activation for productivity tools',
  },
  {
    subCategory: 'User Permissions',
    subIssue: 'User Role / Permission Update Request',
    priority: TicketPriority.MEDIUM,
    priorityLabel: 'P3 – Medium',
    responseTimeMins: 60,
    resolutionTimeMins: 480, // 8 hours
    description: 'Branch or employee role entitlement update in business applications',
  },
  {
    subCategory: 'Reports & MIS',
    subIssue: 'Custom Report / MIS Export Issue',
    priority: TicketPriority.MEDIUM,
    priorityLabel: 'P3 – Medium',
    responseTimeMins: 60,
    resolutionTimeMins: 1440, // 1 business day
    description: 'Scheduled financial / regulatory report generation latency',
  },
  {
    subCategory: 'Data Management',
    subIssue: 'Data Correction / Rectification Request',
    priority: TicketPriority.MEDIUM,
    priorityLabel: 'P3 – Medium',
    responseTimeMins: 60,
    resolutionTimeMins: 1440, // 1 business day
    description: 'Approved data value correction in core loan database',
  },
  {
    subCategory: 'Software Installation',
    subIssue: 'New Software Installation Request',
    priority: TicketPriority.LOW,
    priorityLabel: 'P4 – Low',
    responseTimeMins: 240, // 4 business hours
    resolutionTimeMins: 2880, // 2 business days
    description: 'Standard software installation request with approved business justification',
  },
];

export const STANDARD_ESCALATION_RULES = [
  {
    level: 'L1',
    trigger: 'response',
    timeBeforeMins: 15,
    action: 'notify',
    description: 'L1 Helpdesk: Log ticket and perform initial diagnosis',
  },
  {
    level: 'L2',
    trigger: 'resolution',
    timeBeforeMins: 120,
    action: 'notify',
    description: 'L2 Desktop / Hardware / Software Support: Troubleshoot, repair, or replace',
  },
  {
    level: 'L3',
    trigger: 'resolution',
    timeBeforeMins: 60,
    action: 'notify',
    description: 'L3 IT Manager: 75% of resolution SLA consumed, review & prioritize',
  },
  {
    level: 'L4',
    trigger: 'resolution',
    timeBeforeMins: 15,
    action: 'escalate',
    description: 'Management & OEM Escalation: SLA breached, approve emergency action',
  },
];

export async function seedHardwareAndSoftwareSLA() {
  console.log('🚀 Seeding SLA Policies and Category Configurations for IT Hardware & Software...');

  // 1. Find or create an admin user for createdById
  let admin = await prisma.user.findFirst({
    where: { role: { in: ['SUPER_ADMIN', 'ADMIN'] } },
    select: { id: true, email: true },
  });

  if (!admin) {
    admin = await prisma.user.findFirst({ select: { id: true, email: true } });
  }

  if (!admin) {
    throw new Error('No user found to assign as creator of SLA policies');
  }

  // 2. Ensure IT Hardware Department exists
  let hwDept = await prisma.department.findFirst({
    where: {
      OR: [
        { name: 'IT Hardware' },
        { name: { contains: 'Hardware', mode: 'insensitive' } },
        { type: { contains: 'Hardware', mode: 'insensitive' } },
      ],
    },
  });

  if (!hwDept) {
    hwDept = await prisma.department.create({
      data: {
        name: 'IT Hardware',
        type: 'IT Hardware',
        description: 'Hardware procurement, maintenance, repair, and support',
        color: '#3B82F6',
        icon: 'computer',
      },
    });
    console.log(`✅ Created IT Hardware Department: ${hwDept.id}`);
  } else {
    console.log(`ℹ️ Found IT Hardware Department: ${hwDept.name} (${hwDept.id})`);
  }

  // 3. Ensure IT Software Department exists
  let swDept = await prisma.department.findFirst({
    where: {
      OR: [
        { name: 'IT Software' },
        { name: { contains: 'Software', mode: 'insensitive' } },
        { type: { contains: 'Software', mode: 'insensitive' } },
      ],
    },
  });

  if (!swDept) {
    swDept = await prisma.department.create({
      data: {
        name: 'IT Software',
        type: 'IT Software',
        description: 'Software licenses, installations, LOS/LMS, and SaaS management',
        color: '#8B5CF6',
        icon: 'code',
      },
    });
    console.log(`✅ Created IT Software Department: ${swDept.id}`);
  } else {
    console.log(`ℹ️ Found IT Software Department: ${swDept.name} (${swDept.id})`);
  }

  // 4. Configure TicketCategoryConfig for IT Hardware
  const hwSubCategories = Array.from(new Set(HARDWARE_SLA_MATRIX.map((m) => m.subCategory)));
  const hwSubIssues: Record<string, string[]> = {};
  for (const m of HARDWARE_SLA_MATRIX) {
    if (!hwSubIssues[m.subCategory]) hwSubIssues[m.subCategory] = [];
    if (!hwSubIssues[m.subCategory].includes(m.subIssue)) {
      hwSubIssues[m.subCategory].push(m.subIssue);
    }
  }

  const hwFormFields = {
    subCategories: hwSubCategories,
    subIssues: hwSubIssues,
    items: hwSubIssues,
    defaultGroup: 'Vendor Support-FMS',
  };

  for (const cat of [TicketCategory.HARDWARE_REQUEST, TicketCategory.INCIDENT, TicketCategory.SERVICE_REQUEST]) {
    await prisma.ticketCategoryConfig.upsert({
      where: {
        departmentId_category: {
          departmentId: hwDept.id,
          category: cat,
        },
      },
      update: {
        formFields: hwFormFields,
        isActive: true,
      },
      create: {
        departmentId: hwDept.id,
        category: cat,
        isActive: true,
        defaultPriority: TicketPriority.MEDIUM,
        formFields: hwFormFields,
      },
    });
  }
  console.log('✅ Configured Category requirements & sub-issues for IT Hardware');

  // 5. Configure TicketCategoryConfig for IT Software
  const swSubCategories = Array.from(new Set(SOFTWARE_SLA_MATRIX.map((m) => m.subCategory)));
  const swSubIssues: Record<string, string[]> = {};
  for (const m of SOFTWARE_SLA_MATRIX) {
    if (!swSubIssues[m.subCategory]) swSubIssues[m.subCategory] = [];
    if (!swSubIssues[m.subCategory].includes(m.subIssue)) {
      swSubIssues[m.subCategory].push(m.subIssue);
    }
  }

  const swFormFields = {
    subCategories: swSubCategories,
    subIssues: swSubIssues,
    items: swSubIssues,
    defaultGroup: 'Internal IT Support',
  };

  for (const cat of [TicketCategory.SOFTWARE_REQUEST, TicketCategory.INCIDENT, TicketCategory.SERVICE_REQUEST]) {
    await prisma.ticketCategoryConfig.upsert({
      where: {
        departmentId_category: {
          departmentId: swDept.id,
          category: cat,
        },
      },
      update: {
        formFields: swFormFields,
        isActive: true,
      },
      create: {
        departmentId: swDept.id,
        category: cat,
        isActive: true,
        defaultPriority: TicketPriority.MEDIUM,
        formFields: swFormFields,
      },
    });
  }
  console.log('✅ Configured Category requirements & sub-issues for IT Software');

  // 6. Seed IT Hardware Sub-Issue SLA Policies
  console.log('🔄 Upserting 20 Hardware SLA Policies...');
  for (const item of HARDWARE_SLA_MATRIX) {
    const policyName = `HW: ${item.subIssue}`;
    await prisma.sLAPolicy.upsert({
      where: { name: policyName },
      update: {
        departmentId: hwDept.id,
        category: TicketCategory.HARDWARE_REQUEST,
        subCategory: item.subIssue,
        priority: item.priority,
        responseTimeMins: item.responseTimeMins,
        resolutionTimeMins: item.resolutionTimeMins,
        businessHoursOnly: true,
        excludesWeekends: true,
        escalationRules: STANDARD_ESCALATION_RULES,
        description: item.description,
        isActive: true,
      },
      create: {
        name: policyName,
        departmentId: hwDept.id,
        category: TicketCategory.HARDWARE_REQUEST,
        subCategory: item.subIssue,
        priority: item.priority,
        responseTimeMins: item.responseTimeMins,
        resolutionTimeMins: item.resolutionTimeMins,
        businessHoursOnly: true,
        excludesWeekends: true,
        escalationRules: STANDARD_ESCALATION_RULES,
        description: item.description,
        isActive: true,
        createdById: admin.id,
      },
    });
  }

  // 7. Seed IT Hardware Department Priority Fallback SLA Policies
  const hwPriorityFallbacks = [
    { priority: TicketPriority.CRITICAL, name: 'IT Hardware - Critical (P1) Fallback', resp: 15, res: 120 },
    { priority: TicketPriority.HIGH, name: 'IT Hardware - High (P2) Fallback', resp: 30, res: 240 },
    { priority: TicketPriority.MEDIUM, name: 'IT Hardware - Medium (P3) Fallback', resp: 60, res: 480 },
    { priority: TicketPriority.LOW, name: 'IT Hardware - Low (P4) Fallback', resp: 240, res: 2880 },
  ];

  for (const p of hwPriorityFallbacks) {
    await prisma.sLAPolicy.upsert({
      where: { name: p.name },
      update: {
        departmentId: hwDept.id,
        priority: p.priority,
        responseTimeMins: p.resp,
        resolutionTimeMins: p.res,
        businessHoursOnly: true,
        excludesWeekends: true,
        escalationRules: STANDARD_ESCALATION_RULES,
        isActive: true,
      },
      create: {
        name: p.name,
        departmentId: hwDept.id,
        priority: p.priority,
        responseTimeMins: p.resp,
        resolutionTimeMins: p.res,
        businessHoursOnly: true,
        excludesWeekends: true,
        escalationRules: STANDARD_ESCALATION_RULES,
        isActive: true,
        createdById: admin.id,
      },
    });
  }

  // 8. Seed IT Software Sub-Issue SLA Policies
  console.log('🔄 Upserting 14 Software SLA Policies...');
  for (const item of SOFTWARE_SLA_MATRIX) {
    const policyName = `SW: ${item.subIssue}`;
    await prisma.sLAPolicy.upsert({
      where: { name: policyName },
      update: {
        departmentId: swDept.id,
        category: TicketCategory.SOFTWARE_REQUEST,
        subCategory: item.subIssue,
        priority: item.priority,
        responseTimeMins: item.responseTimeMins,
        resolutionTimeMins: item.resolutionTimeMins,
        businessHoursOnly: true,
        excludesWeekends: true,
        escalationRules: STANDARD_ESCALATION_RULES,
        description: item.description,
        isActive: true,
      },
      create: {
        name: policyName,
        departmentId: swDept.id,
        category: TicketCategory.SOFTWARE_REQUEST,
        subCategory: item.subIssue,
        priority: item.priority,
        responseTimeMins: item.responseTimeMins,
        resolutionTimeMins: item.resolutionTimeMins,
        businessHoursOnly: true,
        excludesWeekends: true,
        escalationRules: STANDARD_ESCALATION_RULES,
        description: item.description,
        isActive: true,
        createdById: admin.id,
      },
    });
  }

  // 9. Seed IT Software Department Priority Fallback SLA Policies
  const swPriorityFallbacks = [
    { priority: TicketPriority.CRITICAL, name: 'IT Software - Critical (P1) Fallback', resp: 15, res: 120 },
    { priority: TicketPriority.HIGH, name: 'IT Software - High (P2) Fallback', resp: 30, res: 240 },
    { priority: TicketPriority.MEDIUM, name: 'IT Software - Medium (P3) Fallback', resp: 60, res: 480 },
    { priority: TicketPriority.LOW, name: 'IT Software - Low (P4) Fallback', resp: 240, res: 2880 },
  ];

  for (const p of swPriorityFallbacks) {
    await prisma.sLAPolicy.upsert({
      where: { name: p.name },
      update: {
        departmentId: swDept.id,
        priority: p.priority,
        responseTimeMins: p.resp,
        resolutionTimeMins: p.res,
        businessHoursOnly: true,
        excludesWeekends: true,
        escalationRules: STANDARD_ESCALATION_RULES,
        isActive: true,
      },
      create: {
        name: p.name,
        departmentId: swDept.id,
        priority: p.priority,
        responseTimeMins: p.resp,
        resolutionTimeMins: p.res,
        businessHoursOnly: true,
        excludesWeekends: true,
        escalationRules: STANDARD_ESCALATION_RULES,
        isActive: true,
        createdById: admin.id,
      },
    });
  }

  console.log('🎉 Successfully seeded all IT Hardware & Software SLA Policies and Category Configurations!');
}

if (require.main === module) {
  seedHardwareAndSoftwareSLA()
    .catch((err) => {
      console.error('❌ Failed to seed SLA policies:', err);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
