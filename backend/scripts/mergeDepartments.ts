import { prisma } from '../src/config/prisma';

async function main() {
  const targetId = 'e9dac65a-9e69-4075-886e-b530e8a105c1'; // Digital Security
  const sourceId = '6d2f72cb-ffd1-4fe5-95b9-784f8498c204'; // AI & Machine Learning

  console.log('--- MERGING DEPARTMENTS ---');

  // 1. Rename target department to "Digital Security and AI"
  const updatedDept = await prisma.department.update({
    where: { id: targetId },
    data: {
      name: 'Digital Security and AI',
      description: 'Digital security, access control, AI models, and machine learning operations',
      color: '#EF4444',
    },
  });
  console.log('Renamed target department:', updatedDept.name);

  // 2. Re-link Users from source to target
  const usersUpdated = await prisma.user.updateMany({
    where: { departmentId: sourceId },
    data: { departmentId: targetId },
  });
  console.log(`Re-linked ${usersUpdated.count} users to Digital Security and AI`);

  // 3. Re-link Tickets from source to target
  const ticketsUpdated = await prisma.ticket.updateMany({
    where: { departmentId: sourceId },
    data: { departmentId: targetId },
  });
  console.log(`Re-linked ${ticketsUpdated.count} tickets to Digital Security and AI`);

  // 4. Re-link Teams from source to target
  const teamsUpdated = await prisma.team.updateMany({
    where: { departmentId: sourceId },
    data: { departmentId: targetId },
  });
  console.log(`Re-linked ${teamsUpdated.count} teams to Digital Security and AI`);

  // 5. Re-link Assets from source to target
  const assetsUpdated = await prisma.asset.updateMany({
    where: { departmentId: sourceId },
    data: { departmentId: targetId },
  });
  console.log(`Re-linked ${assetsUpdated.count} assets to Digital Security and AI`);

  // 6. Re-link CustomFields from source to target
  const fieldsUpdated = await prisma.customField.updateMany({
    where: { departmentId: sourceId },
    data: { departmentId: targetId },
  });
  console.log(`Re-linked ${fieldsUpdated.count} custom fields to Digital Security and AI`);

  // 6b. Re-link KnowledgeBase from source to target
  const kbUpdated = await prisma.knowledgeBase.updateMany({
    where: { departmentId: sourceId },
    data: { departmentId: targetId },
  });
  console.log(`Re-linked ${kbUpdated.count} knowledge bases to Digital Security and AI`);

  // 7. Delete source department
  await prisma.department.delete({
    where: { id: sourceId },
  });
  console.log('Deleted old AI & Machine Learning department record.');

  console.log('--- MERGE COMPLETE ---');
}

main().catch(console.error).finally(() => prisma.$disconnect());
