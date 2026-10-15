import { prisma } from '../src/config/prisma';

async function main() {
  const depts = await prisma.department.findMany({
    include: {
      _count: { select: { users: true, tickets: true, teams: true } },
    },
  });
  console.log('CURRENT DEPARTMENTS:', JSON.stringify(depts, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
