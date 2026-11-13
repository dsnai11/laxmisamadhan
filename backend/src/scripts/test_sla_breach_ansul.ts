import { prisma } from '../config/prisma';
import escalationService from '../services/escalation.service';
import { TicketStatus, TicketPriority, TicketCategory, SLAStatus } from '@prisma/client';

async function runTest() {
  console.log('--- 1. Setting Department Heads ---');
  await prisma.department.updateMany({
    where: { name: { contains: 'Application', mode: 'insensitive' } },
    data: { headId: '1650cc33-1768-45ba-b304-bc377867fe92' }, // Vinod Kumar Maheswari
  });
  await prisma.department.updateMany({
    where: { name: { contains: 'Hardware', mode: 'insensitive' } },
    data: { headId: 'e87f3a4b-3f21-4786-999c-84bf66355bce' }, // Sunil Kumar Verma
  });
  console.log('✓ Department heads linked in database.');

  const itAppDept = await prisma.department.findFirst({
    where: { name: { contains: 'Application', mode: 'insensitive' } },
    include: { head: true },
  });
  console.log(`IT Application Head: ${itAppDept?.head?.firstName} ${itAppDept?.head?.lastName} (${itAppDept?.headId})`);

  const ansul = await prisma.user.findFirst({
    where: { email: { contains: 'ansul.khandelwal', mode: 'insensitive' } },
  });
  if (!ansul) throw new Error('Agent Ansul not found');
  console.log(`Agent: ${ansul.firstName} ${ansul.lastName} (${ansul.id})`);

  const raiser = await prisma.user.findFirst({
    where: { role: 'RAISER' },
  });
  if (!raiser) throw new Error('Raiser not found');

  const testTicketNumber = `TEST-SLA-${Date.now().toString().slice(-6)}`;
  console.log(`\n--- 2. Creating test ticket ${testTicketNumber} assigned to Ansul ---`);

  const pastDate = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2 hours ago

  const testTicket = await prisma.ticket.create({
    data: {
      ticketNumber: testTicketNumber,
      title: 'TEST SLA Breach Reassignment for Ansul',
      description: 'Automated test ticket to verify SLA breach escalation chain',
      status: TicketStatus.OPEN,
      priority: TicketPriority.HIGH,
      category: TicketCategory.SOFTWARE_REQUEST,
      slaStatus: SLAStatus.BREACHED,
      resolutionDueAt: pastDate,
      responseDueAt: pastDate,
      departmentId: itAppDept!.id,
      assignedToId: ansul.id,
      raisedById: raiser.id,
      tags: ['TEST_AUTOMATION'],
    },
  });

  console.log(`Created ticket ID: ${testTicket.id}, Assigned to: Ansul (${testTicket.assignedToId})`);

  console.log('\n--- 3. Running First Escalation Check (Should reassign to Team Lead: Shailesh Tripathi) ---');
  const res1 = await escalationService.runEscalationCheck();
  console.log('Escalation Result 1:', res1.details);

  const afterFirstCheck = await prisma.ticket.findUnique({
    where: { id: testTicket.id },
    include: { assignedTo: true },
  });
  console.log(`After 1st Check Assigned To: ${afterFirstCheck?.assignedTo?.firstName} ${afterFirstCheck?.assignedTo?.lastName} (${afterFirstCheck?.assignedTo?.email})`);
  console.log(`Tags:`, afterFirstCheck?.tags);
  console.log(`Priority:`, afterFirstCheck?.priority);

  if (afterFirstCheck?.assignedTo?.email !== 'shailesh.tripathi@lifc.in') {
    throw new Error(`FAIL: Expected ticket to be assigned to shailesh.tripathi@lifc.in but got ${afterFirstCheck?.assignedTo?.email}`);
  }
  console.log('✓ SUCCESS: Ticket was successfully reassigned to Team Lead (Shailesh Tripathi)!');

  console.log('\n--- 4. Running Second Escalation Check (Should reassign to Department Head: Vinod Kumar Maheswari) ---');
  const res2 = await escalationService.runEscalationCheck();
  console.log('Escalation Result 2:', res2.details);

  const afterSecondCheck = await prisma.ticket.findUnique({
    where: { id: testTicket.id },
    include: { assignedTo: true },
  });
  console.log(`After 2nd Check Assigned To: ${afterSecondCheck?.assignedTo?.firstName} ${afterSecondCheck?.assignedTo?.lastName} (${afterSecondCheck?.assignedTo?.email})`);
  console.log(`Tags:`, afterSecondCheck?.tags);
  console.log(`Priority:`, afterSecondCheck?.priority);

  if (afterSecondCheck?.assignedTo?.email !== 'vinod.maheshwari@lifc.in') {
    throw new Error(`FAIL: Expected ticket to be assigned to vinod.maheshwari@lifc.in but got ${afterSecondCheck?.assignedTo?.email}`);
  }
  console.log('✓ SUCCESS: Ticket was successfully reassigned to Department Head (Vinod Kumar Maheswari)!');

  console.log('\n--- 5. Checking Ticket Updates & Notifications Created ---');
  const updates = await prisma.ticketUpdate.findMany({
    where: { ticketId: testTicket.id },
    orderBy: { createdAt: 'asc' },
  });
  for (const u of updates) {
    console.log(`Audit log: field=${u.field}, oldValue=${u.oldValue}, newValue=${u.newValue}`);
  }

  const notifications = await prisma.notification.findMany({
    where: { referenceId: testTicket.id },
    include: { user: { select: { firstName: true, lastName: true, email: true } } },
    orderBy: { createdAt: 'asc' },
  });
  for (const n of notifications) {
    console.log(`Notification to ${n.user.firstName} ${n.user.lastName}: [${n.type}] ${n.title} - ${n.message}`);
  }

  console.log('\n--- 6. Cleaning Up Test Ticket ---');
  await prisma.notification.deleteMany({ where: { referenceId: testTicket.id } });
  await prisma.ticketUpdate.deleteMany({ where: { ticketId: testTicket.id } });
  await prisma.ticket.delete({ where: { id: testTicket.id } });
  console.log('✓ Test ticket and audit entries cleaned up.');

  console.log('\n=============================================');
  console.log('ALL SLA BREACH ESCALATION TESTS PASSED!');
  console.log('=============================================');
}

runTest()
  .catch((e) => {
    console.error('Test error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
