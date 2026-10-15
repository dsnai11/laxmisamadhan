import { PrismaClient, UserRole, UserStatus, TicketCategory, TicketPriority, TicketStatus, AssetType } from '@prisma/client';
import { hashPassword } from '../src/utils/encryption';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create departments
  const departments = await Promise.all([
    prisma.department.upsert({
      where: { name: 'IT Hardware' },
      update: {},
      create: {
        name: 'IT Hardware',
        type: 'IT Hardware',
        description: 'Hardware procurement, maintenance, and support',
        color: '#3B82F6',
        icon: 'computer',
      },
    }),
    prisma.department.upsert({
      where: { name: 'IT Software' },
      update: {},
      create: {
        name: 'IT Software',
        type: 'IT Software',
        description: 'Software licenses, installations, and SaaS management',
        color: '#8B5CF6',
        icon: 'code',
      },
    }),
    prisma.department.upsert({
      where: { name: 'Digital Security and AI' },
      update: {},
      create: {
        name: 'Digital Security and AI',
        type: 'Digital Security and AI',
        description: 'Security incidents, AI operations, access control, and compliance',
        color: '#EF4444',
        icon: 'shield',
      },
    }),
    prisma.department.upsert({
      where: { name: 'Human Resources' },
      update: {},
      create: {
        name: 'Human Resources',
        type: 'HR',
        description: 'Employee onboarding, HR queries, and payroll support',
        color: '#10B981',
        icon: 'users',
      },
    }),
    prisma.department.upsert({
      where: { name: 'Administration' },
      update: {},
      create: {
        name: 'Administration',
        type: 'Admin',
        description: 'Facilities, administrative requests, and logistics',
        color: '#F59E0B',
        icon: 'building',
      },
    }),
  ]);

  console.log('✅ Departments created');

  // Create super admin
  const adminPassword = await hashPassword('Admin@123456');
  const admin = await prisma.user.upsert({
    where: { email: 'admin@ticketportal.local' },
    update: {},
    create: {
      email: 'admin@ticketportal.local',
      passwordHash: adminPassword,
      firstName: 'System',
      lastName: 'Administrator',
      role: UserRole.SUPER_ADMIN,
      status: UserStatus.ACTIVE,
      emailVerified: true,
      lastPasswordChange: new Date(),
    },
  });

  console.log('✅ Super admin created');
  console.log(`   Email: admin@ticketportal.local`);
  console.log(`   Temporary Password: Admin@123456`);

  // Create department heads
  const heads = await Promise.all([
    prisma.user.upsert({
      where: { email: 'hardware.head@ticketportal.local' },
      update: {},
      create: {
        email: 'hardware.head@ticketportal.local',
        passwordHash: await hashPassword('Head@123456'),
        firstName: 'Hardware',
        lastName: 'Head',
        role: UserRole.DEPARTMENT_HEAD,
        status: UserStatus.ACTIVE,
        departmentId: departments[0].id,
        emailVerified: true,
        lastPasswordChange: new Date(),
      },
    }),
    prisma.user.upsert({
      where: { email: 'software.head@ticketportal.local' },
      update: {},
      create: {
        email: 'software.head@ticketportal.local',
        passwordHash: await hashPassword('Head@123456'),
        firstName: 'Software',
        lastName: 'Head',
        role: UserRole.DEPARTMENT_HEAD,
        status: UserStatus.ACTIVE,
        departmentId: departments[1].id,
        emailVerified: true,
        lastPasswordChange: new Date(),
      },
    }),
    prisma.user.upsert({
      where: { email: 'security.head@ticketportal.local' },
      update: {},
      create: {
        email: 'security.head@ticketportal.local',
        passwordHash: await hashPassword('Head@123456'),
        firstName: 'Security',
        lastName: 'Head',
        role: UserRole.DEPARTMENT_HEAD,
        status: UserStatus.ACTIVE,
        departmentId: departments[2].id,
        emailVerified: true,
        lastPasswordChange: new Date(),
      },
    }),
    prisma.user.upsert({
      where: { email: 'ai.head@ticketportal.local' },
      update: {},
      create: {
        email: 'ai.head@ticketportal.local',
        passwordHash: await hashPassword('Head@123456'),
        firstName: 'AI',
        lastName: 'Head',
        role: UserRole.DEPARTMENT_HEAD,
        status: UserStatus.ACTIVE,
        departmentId: departments[3].id,
        emailVerified: true,
        lastPasswordChange: new Date(),
      },
    }),
  ]);

  // Assign department heads
  await Promise.all(
    departments.map((dept, i) =>
      heads[i]
        ? prisma.department.update({
            where: { id: dept.id },
            data: { headId: heads[i].id },
          })
        : Promise.resolve()
    )
  );

  console.log('✅ Department heads created');

  // Create agents
  const agents = await Promise.all([
    prisma.user.upsert({
      where: { email: 'agent.hardware@ticketportal.local' },
      update: {},
      create: {
        email: 'agent.hardware@ticketportal.local',
        passwordHash: await hashPassword('Agent@123456'),
        firstName: 'Hardware',
        lastName: 'Agent',
        role: UserRole.AGENT,
        status: UserStatus.ACTIVE,
        departmentId: departments[0].id,
        managerId: heads[0].id,
        emailVerified: true,
        lastPasswordChange: new Date(),
      },
    }),
    prisma.user.upsert({
      where: { email: 'agent.software@ticketportal.local' },
      update: {},
      create: {
        email: 'agent.software@ticketportal.local',
        passwordHash: await hashPassword('Agent@123456'),
        firstName: 'Software',
        lastName: 'Agent',
        role: UserRole.AGENT,
        status: UserStatus.ACTIVE,
        departmentId: departments[1].id,
        managerId: heads[1].id,
        emailVerified: true,
        lastPasswordChange: new Date(),
      },
    }),
    prisma.user.upsert({
      where: { email: 'agent.security@ticketportal.local' },
      update: {},
      create: {
        email: 'agent.security@ticketportal.local',
        passwordHash: await hashPassword('Agent@123456'),
        firstName: 'Security',
        lastName: 'Agent',
        role: UserRole.AGENT,
        status: UserStatus.ACTIVE,
        departmentId: departments[2].id,
        managerId: heads[2].id,
        emailVerified: true,
        lastPasswordChange: new Date(),
      },
    }),
    prisma.user.upsert({
      where: { email: 'agent.ai@ticketportal.local' },
      update: {},
      create: {
        email: 'agent.ai@ticketportal.local',
        passwordHash: await hashPassword('Agent@123456'),
        firstName: 'AI',
        lastName: 'Agent',
        role: UserRole.AGENT,
        status: UserStatus.ACTIVE,
        departmentId: departments[3].id,
        managerId: heads[3].id,
        emailVerified: true,
        lastPasswordChange: new Date(),
      },
    }),
  ]);

  console.log('✅ Agents created');

  // Create sample raisers
  const raisers = await Promise.all([
    prisma.user.upsert({
      where: { email: 'john.doe@company.com' },
      update: {},
      create: {
        email: 'john.doe@company.com',
        passwordHash: await hashPassword('User@123456'),
        firstName: 'John',
        lastName: 'Doe',
        role: UserRole.RAISER,
        status: UserStatus.ACTIVE,
        departmentId: departments[0].id,
        emailVerified: true,
        lastPasswordChange: new Date(),
      },
    }),
    prisma.user.upsert({
      where: { email: 'jane.smith@company.com' },
      update: {},
      create: {
        email: 'jane.smith@company.com',
        passwordHash: await hashPassword('User@123456'),
        firstName: 'Jane',
        lastName: 'Smith',
        role: UserRole.RAISER,
        status: UserStatus.ACTIVE,
        departmentId: departments[1].id,
        emailVerified: true,
        lastPasswordChange: new Date(),
      },
    }),
  ]);

  console.log('✅ Sample raisers created');

  // Create SLA policies
  const slaPolicies = await Promise.all([
    prisma.sLAPolicy.upsert({
      where: { id: 'sla-critical' },
      update: {},
      create: {
        id: 'sla-critical',
        name: 'Critical - 1hr Response / 4hr Resolution',
        priority: TicketPriority.CRITICAL,
        responseTimeMins: 60,
        resolutionTimeMins: 240,
        businessHoursOnly: true,
        excludesWeekends: true,
        isActive: true,
        createdById: admin.id,
      },
    }),
    prisma.sLAPolicy.upsert({
      where: { id: 'sla-high' },
      update: {},
      create: {
        id: 'sla-high',
        name: 'High - 2hr Response / 8hr Resolution',
        priority: TicketPriority.HIGH,
        responseTimeMins: 120,
        resolutionTimeMins: 480,
        businessHoursOnly: true,
        excludesWeekends: true,
        isActive: true,
        createdById: admin.id,
      },
    }),
    prisma.sLAPolicy.upsert({
      where: { id: 'sla-medium' },
      update: {},
      create: {
        id: 'sla-medium',
        name: 'Medium - 4hr Response / 24hr Resolution',
        priority: TicketPriority.MEDIUM,
        responseTimeMins: 240,
        resolutionTimeMins: 1440,
        businessHoursOnly: true,
        excludesWeekends: true,
        isActive: true,
        createdById: admin.id,
      },
    }),
    prisma.sLAPolicy.upsert({
      where: { id: 'sla-low' },
      update: {},
      create: {
        id: 'sla-low',
        name: 'Low - 8hr Response / 72hr Resolution',
        priority: TicketPriority.LOW,
        responseTimeMins: 480,
        resolutionTimeMins: 4320,
        businessHoursOnly: true,
        excludesWeekends: true,
        isActive: true,
        createdById: admin.id,
      },
    }),
  ]);

  // Assign SLA policies to departments
  await Promise.all(
    departments.map(dept =>
      Promise.all(
        slaPolicies.map(policy =>
          prisma.sLAPolicy.upsert({
            where: { id: `${dept.id}-${policy.priority}` },
            update: {},
            create: {
              id: `${dept.id}-${policy.priority}`,
              name: `${dept.name} - ${policy.name}`,
              departmentId: dept.id,
              priority: policy.priority,
              responseTimeMins: policy.responseTimeMins,
              resolutionTimeMins: policy.resolutionTimeMins,
              businessHoursOnly: policy.businessHoursOnly,
              excludesWeekends: policy.excludesWeekends,
              isActive: true,
              createdById: admin.id,
            },
          })
        )
      )
    )
  );

  console.log('✅ SLA policies created');

  // Create knowledge bases
  const knowledgeBases = await Promise.all(
    departments.map(dept =>
      prisma.knowledgeBase.upsert({
        where: { id: `kb-${dept.id}` },
        update: {},
        create: {
          id: `kb-${dept.id}`,
          name: `${dept.name} Knowledge Base`,
          description: `Official knowledge base for ${dept.name} department`,
          departmentId: dept.id,
          isPublic: false,
        },
      })
    )
  );

  console.log('✅ Knowledge bases created');

  // Create sample articles
  await Promise.all([
    prisma.knowledgeArticle.upsert({
      where: { knowledgeBaseId_slug: { knowledgeBaseId: knowledgeBases[0].id, slug: 'laptop-replacement-policy' } },
      update: {},
      create: {
        knowledgeBaseId: knowledgeBases[0].id,
        title: 'Laptop Replacement Policy',
        slug: 'laptop-replacement-policy',
        content: `
# Laptop Replacement Policy

## Eligibility
- Laptops older than 4 years are eligible for replacement
- Laptops with critical hardware failures are eligible regardless of age
- Accidental damage requires manager approval

## Process
1. Submit a HARDWARE_REQUEST ticket
2. Attach asset tag and photos if damaged
3. Manager approval required for replacements
4. IT Hardware team will arrange procurement

## Timeline
- Standard replacement: 5-10 business days
- Urgent replacement: 2-3 business days (with director approval)
        `,
        category: 'Hardware',
        tags: ['laptop', 'replacement', 'policy', 'hardware'],
        status: 'PUBLISHED',
        authorId: heads[0].id,
        publishedAt: new Date(),
      },
    }),
    prisma.knowledgeArticle.upsert({
      where: { knowledgeBaseId_slug: { knowledgeBaseId: knowledgeBases[1].id, slug: 'software-license-request' } },
      update: {},
      create: {
        knowledgeBaseId: knowledgeBases[1].id,
        title: 'How to Request Software Licenses',
        slug: 'software-license-request',
        content: `
# Software License Request Process

## Available Licenses
- Microsoft 365 (standard for all employees)
- Adobe Creative Cloud (design/marketing teams)
- JetBrains IDEs (development teams)
- Specialized software (case by case)

## Request Process
1. Submit SOFTWARE_REQUEST ticket
2. Specify software name, version, and justification
3. Manager approval required
4. License team provisions and assigns

## Renewal
- Licenses auto-renew annually
- Unused licenses are reclaimed after 90 days of inactivity
        `,
        category: 'Software',
        tags: ['license', 'software', 'request', 'procurement'],
        status: 'PUBLISHED',
        authorId: heads[1].id,
        publishedAt: new Date(),
      },
    }),
    prisma.knowledgeArticle.upsert({
      where: { knowledgeBaseId_slug: { knowledgeBaseId: knowledgeBases[2].id, slug: 'security-incident-reporting' } },
      update: {},
      create: {
        knowledgeBaseId: knowledgeBases[2].id,
        title: 'Security Incident Reporting Guide',
        slug: 'security-incident-reporting',
        content: `
# Security Incident Reporting

## When to Report
- Suspected phishing emails
- Unauthorized access attempts
- Data breaches or leaks
- Malware/virus infections
- Lost/stolen devices with company data

## How to Report
1. **Immediate**: Call Security Hotline: ext. 911
2. **Ticket**: Create SECURITY_INCIDENT ticket
3. **Email**: security@company.com

## What to Include
- Date/time of incident
- Description of what happened
- Affected systems/accounts
- Any actions already taken
- Screenshots/evidence if available

## Response Times
- Critical: 15 minutes
- High: 1 hour
- Medium: 4 hours
- Low: 24 hours
        `,
        category: 'Security',
        tags: ['security', 'incident', 'reporting', 'phishing', 'breach'],
        status: 'PUBLISHED',
        authorId: heads[2].id,
        publishedAt: new Date(),
      },
    }),
    prisma.knowledgeArticle.upsert({
      where: { knowledgeBaseId_slug: { knowledgeBaseId: knowledgeBases[3].id, slug: 'ai-model-deployment-guide' } },
      update: {},
      create: {
        knowledgeBaseId: knowledgeBases[3].id,
        title: 'AI Model Deployment Guide',
        slug: 'ai-model-deployment-guide',
        content: `
# AI Model Deployment Process

## Requirements
- Model documentation (architecture, training data, metrics)
- Containerized model (Docker image)
- Resource requirements (GPU, memory, storage)
- Monitoring and alerting configuration

## Deployment Steps
1. Submit AI_MODEL_REQUEST ticket
2. Attach model card and documentation
3. Security review (data privacy, bias assessment)
4. Infrastructure team provisions resources
5. MLOps team deploys to staging
6. UAT with requester
7. Production deployment with rollback plan

## Monitoring
- Model performance metrics
- Data drift detection
- Latency and throughput
- Error rates and logging
        `,
        category: 'AI/ML',
        tags: ['ai', 'model', 'deployment', 'mlops', 'gpu'],
        status: 'PUBLISHED',
        authorId: heads[3].id,
        publishedAt: new Date(),
      },
    }),
  ]);

  console.log('✅ Sample knowledge articles created');

  // Create sample assets
  await Promise.all([
    prisma.asset.upsert({
      where: { assetTag: 'LAP-001' },
      update: {},
      create: {
        assetTag: 'LAP-001',
        name: 'MacBook Pro 16" M3 Max',
        type: AssetType.LAPTOP,
        serialNumber: 'C02XXXXXXXXX',
        model: 'MacBook Pro 16"',
        manufacturer: 'Apple',
        departmentId: departments[0].id,
        assignedToId: raisers[0].id,
        location: 'Building A, Floor 3',
        purchaseDate: new Date('2024-01-15'),
        warrantyExpiry: new Date('2027-01-15'),
        value: 3499.00,
        status: 'ASSIGNED',
      },
    }),
    prisma.asset.upsert({
      where: { assetTag: 'MON-001' },
      update: {},
      create: {
        assetTag: 'MON-001',
        name: 'Dell UltraSharp 27" 4K',
        type: AssetType.MONITOR,
        serialNumber: 'DELL274K001',
        model: 'U2723QE',
        manufacturer: 'Dell',
        departmentId: departments[0].id,
        assignedToId: raisers[0].id,
        location: 'Building A, Floor 3',
        purchaseDate: new Date('2023-06-01'),
        warrantyExpiry: new Date('2026-06-01'),
        value: 599.00,
        status: 'ASSIGNED',
      },
    }),
    prisma.asset.upsert({
      where: { assetTag: 'SRV-001' },
      update: {},
      create: {
        assetTag: 'SRV-001',
        name: 'Dell PowerEdge R760',
        type: AssetType.SERVER,
        serialNumber: 'SRV760001',
        model: 'PowerEdge R760',
        manufacturer: 'Dell',
        departmentId: departments[3].id,
        location: 'Data Center, Rack 12',
        purchaseDate: new Date('2024-03-01'),
        warrantyExpiry: new Date('2027-03-01'),
        value: 25000.00,
        status: 'AVAILABLE',
        specifications: {
          cpu: '2x Intel Xeon Platinum 8480+',
          ram: '1TB DDR5',
          storage: '8x 3.84TB NVMe',
          gpu: '4x NVIDIA H100',
        },
      },
    }),
  ]);

  console.log('✅ Sample assets created');

  // Create custom fields
  await Promise.all([
    prisma.customField.upsert({
      where: { id: 'cf-urgency-justification' },
      update: {},
      create: {
        id: 'cf-urgency-justification',
        name: 'urgencyJustification',
        label: 'Urgency Justification',
        type: 'TEXTAREA',
        departmentId: departments[0].id,
        category: TicketCategory.HARDWARE_REQUEST,
        isRequired: true,
        validation: { minLength: 50, maxLength: 2000 },
        order: 1,
      },
    }),
    prisma.customField.upsert({
      where: { id: 'cf-software-version' },
      update: {},
      create: {
        id: 'cf-software-version',
        name: 'softwareVersion',
        label: 'Software Version Required',
        type: 'TEXT',
        departmentId: departments[1].id,
        category: TicketCategory.SOFTWARE_REQUEST,
        isRequired: true,
        validation: { maxLength: 50 },
        order: 1,
      },
    }),
    prisma.customField.upsert({
      where: { id: 'cf-security-classification' },
      update: {},
      create: {
        id: 'cf-security-classification',
        name: 'securityClassification',
        label: 'Data Classification',
        type: 'SELECT',
        departmentId: departments[2].id,
        category: TicketCategory.SECURITY_INCIDENT,
        isRequired: true,
        options: [
          { value: 'public', label: 'Public' },
          { value: 'internal', label: 'Internal' },
          { value: 'confidential', label: 'Confidential' },
          { value: 'restricted', label: 'Restricted' },
        ],
        order: 1,
      },
    }),
    prisma.customField.upsert({
      where: { id: 'cf-gpu-requirement' },
      update: {},
      create: {
        id: 'cf-gpu-requirement',
        name: 'gpuRequirement',
        label: 'GPU Required',
        type: 'BOOLEAN',
        departmentId: departments[3].id,
        category: TicketCategory.AI_MODEL_REQUEST,
        isRequired: true,
        defaultValue: true,
        order: 1,
      },
    }),
  ]);

  console.log('✅ Custom fields created');

  // Create sample tickets
  const ticket1 = await prisma.ticket.create({
    data: {
      ticketNumber: 'HW-24-00001',
      title: 'Laptop not charging - MacBook Pro 16"',
      description: 'My MacBook Pro 16" (asset tag LAP-001) is not charging when plugged in. Tried multiple chargers and outlets. Battery currently at 15%. Need urgent replacement as I have client presentations tomorrow.',
      category: TicketCategory.HARDWARE_REQUEST,
      priority: TicketPriority.HIGH,
      departmentId: departments[0].id,
      raisedById: raisers[0].id,
      assignedToId: agents[0].id,
      assignedAt: new Date(),
      status: TicketStatus.ASSIGNED,
      tags: ['urgent', 'charging', 'macbook'],
      slaPolicyId: slaPolicies[1].id,
    },
  });

  const ticket2 = await prisma.ticket.create({
    data: {
      ticketNumber: 'SW-24-00001',
      title: 'Adobe Creative Cloud license request',
      description: 'Need Adobe Creative Cloud license for new marketing hire starting Monday. Required apps: Photoshop, Illustrator, InDesign.',
      category: TicketCategory.SOFTWARE_REQUEST,
      priority: TicketPriority.MEDIUM,
      departmentId: departments[1].id,
      raisedById: raisers[1].id,
      status: TicketStatus.OPEN,
      tags: ['adobe', 'creative-cloud', 'new-hire'],
      slaPolicyId: slaPolicies[2].id,
    },
  });

  const ticket3 = await prisma.ticket.create({
    data: {
      ticketNumber: 'SEC-24-00001',
      title: 'Suspicious phishing email received',
      description: 'Received email claiming to be from IT asking for password reset. Link goes to suspicious domain. Did not click link. Reporting for awareness.',
      category: TicketCategory.SECURITY_INCIDENT,
      priority: TicketPriority.HIGH,
      departmentId: departments[2].id,
      raisedById: raisers[0].id,
      assignedToId: agents[2].id,
      assignedAt: new Date(),
      status: TicketStatus.IN_PROGRESS,
      tags: ['phishing', 'email', 'security-awareness'],
      slaPolicyId: slaPolicies[1].id,
    },
  });

  // Add comments to tickets
  await prisma.comment.create({
    data: {
      ticketId: ticket1.id,
      userId: agents[0].id,
      content: 'Received your ticket. Checking asset LAP-001 warranty status and arranging replacement. Will update within 2 hours.',
      isInternal: false,
    },
  });

  await prisma.comment.create({
    data: {
      ticketId: ticket2.id,
      userId: heads[1].id,
      content: 'Approved. Forwarding to software licensing team for provisioning.',
      isInternal: true,
    },
  });

  console.log('✅ Sample tickets created');

  // Create teams
  await Promise.all([
    prisma.team.upsert({
      where: { id: 'team-hardware-support' },
      update: {},
      create: {
        id: 'team-hardware-support',
        name: 'Hardware Support Team',
        description: 'Laptop, desktop, and peripheral support',
        departmentId: departments[0].id,
        leadId: agents[0].id,
      },
    }),
    prisma.team.upsert({
      where: { id: 'team-software-licensing' },
      update: {},
      create: {
        id: 'team-software-licensing',
        name: 'Software Licensing Team',
        description: 'License procurement and management',
        departmentId: departments[1].id,
        leadId: agents[1].id,
      },
    }),
    prisma.team.upsert({
      where: { id: 'team-security-operations' },
      update: {},
      create: {
        id: 'team-security-operations',
        name: 'Security Operations',
        description: 'Incident response and threat monitoring',
        departmentId: departments[2].id,
        leadId: agents[2].id,
      },
    }),
    prisma.team.upsert({
      where: { id: 'team-ml-platform' },
      update: {},
      create: {
        id: 'team-ml-platform',
        name: 'ML Platform Team',
        description: 'Model deployment and MLOps',
        departmentId: departments[3].id,
        leadId: agents[3].id,
      },
    }),
  ]);

  console.log('✅ Teams created');

  console.log('');
  console.log('🎉 Seeding completed successfully!');
  console.log('');
  console.log('Test Accounts:');
  console.log('  Super Admin: admin@ticketportal.local / Admin@123456');
  console.log('  Hardware Head: hardware.head@ticketportal.local / Head@123456');
  console.log('  Software Head: software.head@ticketportal.local / Head@123456');
  console.log('  Security Head: security.head@ticketportal.local / Head@123456');
  console.log('  AI Head: ai.head@ticketportal.local / Head@123456');
  console.log('  Hardware Agent: agent.hardware@ticketportal.local / Agent@123456');
  console.log('  Software Agent: agent.software@ticketportal.local / Agent@123456');
  console.log('  Security Agent: agent.security@ticketportal.local / Agent@123456');
  console.log('  AI Agent: agent.ai@ticketportal.local / Agent@123456');
  console.log('  User: john.doe@company.com / User@123456');
  console.log('  User: jane.smith@company.com / User@123456');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });