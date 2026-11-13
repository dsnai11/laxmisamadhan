import { prisma } from '@config/prisma';
import { createLogger } from '@utils/logger';
import { TicketStatus, TicketPriority, NotificationType, SLAStatus } from '@prisma/client';
import ticketService from './ticket.service';

const logger = createLogger('escalation-service');

export interface EscalationResult {
  evaluated: number;
  escalatedL1: number;
  escalatedL2: number;
  escalatedL3: number;
  details: string[];
}

class EscalationService {
  /**
   * Evaluates all open tickets against multi-level escalation rules.
   */
  async runEscalationCheck(): Promise<EscalationResult> {
    const activeTickets = await prisma.ticket.findMany({
      where: {
        status: { in: [TicketStatus.OPEN, TicketStatus.REOPENED, TicketStatus.DEPENDENCY_ON_CLIENT, TicketStatus.DEPENDENCY_ON_VENDOR] },
      },
      include: {
        department: { include: { head: true, teams: { include: { lead: true } } } },
        assignedTo: true,
        raisedBy: true,
      },
    });

    const result: EscalationResult = {
      evaluated: activeTickets.length,
      escalatedL1: 0,
      escalatedL2: 0,
      escalatedL3: 0,
      details: [],
    };

    const now = Date.now();

    for (const ticket of activeTickets) {
      const createdAtMs = ticket.createdAt.getTime();
      const ageMinutes = (now - createdAtMs) / (60 * 1000);

      // Level 1 Escalation: Unassigned Ticket Timeout (> 30 Mins)
      if (!ticket.assignedToId && ticket.status === TicketStatus.OPEN && ageMinutes >= 30) {
        // Tag ticket as ESCALATED_L1 and notify Dept Head
        await prisma.ticket.update({
          where: { id: ticket.id },
          data: {
            tags: { set: Array.from(new Set([...ticket.tags, 'ESCALATED_L1'])) },
          },
        });

        if (ticket.department?.headId) {
          await prisma.notification.create({
            data: {
              userId: ticket.department.headId,
              type: NotificationType.TICKET_ESCALATED,
              title: '⚡ Level 1 Escalation: Unassigned Ticket',
              message: `Ticket ${ticket.ticketNumber} (${ticket.title}) has been unassigned for over 30 minutes in ${ticket.department.name}.`,
              referenceId: ticket.id,
              referenceType: 'TICKET',
            },
          });
        }

        result.escalatedL1++;
        result.details.push(`Ticket ${ticket.ticketNumber} L1 escalated (Unassigned for ${Math.round(ageMinutes)}m)`);
      }

      // Level 2 Escalation: Approaching SLA Breach (< 30 mins remaining) -> Upgrade Priority
      if (ticket.resolutionDueAt && ticket.slaStatus === SLAStatus.APPROACHING_BREACH) {
        let newPriority = ticket.priority;
        if (ticket.priority === TicketPriority.LOW) newPriority = TicketPriority.MEDIUM;
        else if (ticket.priority === TicketPriority.MEDIUM) newPriority = TicketPriority.HIGH;
        else if (ticket.priority === TicketPriority.HIGH) newPriority = TicketPriority.CRITICAL;

        if (newPriority !== ticket.priority) {
          await prisma.ticket.update({
            where: { id: ticket.id },
            data: {
              priority: newPriority,
              tags: { set: Array.from(new Set([...ticket.tags, 'ESCALATED_L2', 'AUTO_PRIORITY_UPGRADE'])) },
            },
          });

          result.escalatedL2++;
          result.details.push(`Ticket ${ticket.ticketNumber} L2 escalated (Priority auto-upgraded to ${newPriority})`);
        }
      }

      // Level 3 & Level 4 Escalation: Breached SLA -> Hierarchical Reassignment (Team Lead -> Dept Head)
      if (ticket.slaStatus === SLAStatus.BREACHED) {
        const isEscalatedToLead = ticket.tags.includes('ESCALATED_TEAM_LEAD');
        const isEscalatedToDeptHead = ticket.tags.includes('ESCALATED_DEPT_HEAD');

        // Step 1: Escalate to Team Lead if not already escalated to lead
        if (!isEscalatedToLead) {
          let teamLeadId: string | null = null;
          let teamLeadUser: any = null;

          if (ticket.assignedToId) {
            const team = await prisma.team.findFirst({
              where: {
                departmentId: ticket.departmentId,
                members: { some: { id: ticket.assignedToId } },
                leadId: { not: null },
              },
              include: { lead: true },
            });
            if (team?.lead) {
              teamLeadId = team.lead.id;
              teamLeadUser = team.lead;
            }
          }

          if (!teamLeadId && ticket.department?.teams) {
            const deptTeam = ticket.department.teams.find((t: any) => t.leadId && t.lead);
            if (deptTeam?.lead) {
              teamLeadId = deptTeam.lead.id;
              teamLeadUser = deptTeam.lead;
            }
          }

          if (teamLeadId && teamLeadId !== ticket.assignedToId) {
            const previousAssigneeName = ticket.assignedTo
              ? `${ticket.assignedTo.firstName} ${ticket.assignedTo.lastName}`
              : (ticket.assignedToId || 'Unassigned');

            await prisma.ticket.update({
              where: { id: ticket.id },
              data: {
                assignedToId: teamLeadId,
                assignedAt: new Date(),
                priority: TicketPriority.CRITICAL,
                tags: { set: Array.from(new Set([...ticket.tags, 'SLA_ESCALATED', 'ESCALATED_TEAM_LEAD', 'ESCALATED_L3'])) },
              },
            });

            await prisma.ticketUpdate.create({
              data: {
                ticketId: ticket.id,
                userId: teamLeadId,
                field: 'assignedToId',
                oldValue: previousAssigneeName,
                newValue: `${teamLeadUser.firstName} ${teamLeadUser.lastName}`,
                isSystem: true,
              },
            });

            await prisma.notification.create({
              data: {
                userId: teamLeadId,
                type: NotificationType.TICKET_ESCALATED,
                title: '🚨 SLA Breach: Reassigned to Team Lead',
                message: `Ticket ${ticket.ticketNumber} (${ticket.title}) has breached SLA under ${previousAssigneeName} and has been escalated & reassigned to you as Team Lead.`,
                referenceId: ticket.id,
                referenceType: 'TICKET',
              },
            });

            result.escalatedL3++;
            result.details.push(`Ticket ${ticket.ticketNumber} L3 escalated to Team Lead (${teamLeadUser.firstName} ${teamLeadUser.lastName})`);
            continue;
          }
        }

        // Step 2: Escalate to Department Head if already with Team Lead (or if assignee is Team Lead)
        if (!isEscalatedToDeptHead) {
          let deptHeadId = ticket.department?.headId;
          let deptHeadUser = ticket.department?.head;

          if (!deptHeadId && ticket.departmentId) {
            const foundHead = await prisma.user.findFirst({
              where: { departmentId: ticket.departmentId, role: 'DEPARTMENT_HEAD', status: 'ACTIVE' },
            });
            if (foundHead) {
              deptHeadId = foundHead.id;
              deptHeadUser = foundHead;
            }
          }

          if (deptHeadId && deptHeadId !== ticket.assignedToId) {
            const previousAssigneeName = ticket.assignedTo
              ? `${ticket.assignedTo.firstName} ${ticket.assignedTo.lastName}`
              : (ticket.assignedToId || 'Team Lead');

            await prisma.ticket.update({
              where: { id: ticket.id },
              data: {
                assignedToId: deptHeadId,
                assignedAt: new Date(),
                priority: TicketPriority.CRITICAL,
                tags: { set: Array.from(new Set([...ticket.tags, 'SLA_ESCALATED', 'ESCALATED_DEPT_HEAD', 'ESCALATED_L4'])) },
              },
            });

            await prisma.ticketUpdate.create({
              data: {
                ticketId: ticket.id,
                userId: deptHeadId,
                field: 'assignedToId',
                oldValue: previousAssigneeName,
                newValue: deptHeadUser ? `${deptHeadUser.firstName} ${deptHeadUser.lastName}` : 'Department Head',
                isSystem: true,
              },
            });

            await prisma.notification.create({
              data: {
                userId: deptHeadId,
                type: NotificationType.TICKET_ESCALATED,
                title: '🔴 Level 4 SLA Escalation: Reassigned to Department Head',
                message: `CRITICAL: Ticket ${ticket.ticketNumber} (${ticket.title}) breached SLA under Team Lead resolution and has been escalated & reassigned to you as Department Head.`,
                referenceId: ticket.id,
                referenceType: 'TICKET',
              },
            });

            result.escalatedL3++;
            result.details.push(`Ticket ${ticket.ticketNumber} L4 escalated to Department Head (${deptHeadUser?.firstName || 'Head'})`);
            continue;
          }
        }

        // Step 3: Fallback alert if already at Department Head or no leads found
        if (!ticket.tags.includes('ESCALATED_L3')) {
          await prisma.ticket.update({
            where: { id: ticket.id },
            data: {
              priority: TicketPriority.CRITICAL,
              tags: { set: Array.from(new Set([...ticket.tags, 'ESCALATED_L3'])) },
            },
          });

          const alertTarget = ticket.department?.headId || ticket.assignedToId;
          if (alertTarget) {
            await prisma.notification.create({
              data: {
                userId: alertTarget,
                type: NotificationType.SLA_BREACHED,
                title: '🔴 Level 3 Escalation: SLA Breached',
                message: `CRITICAL: Ticket ${ticket.ticketNumber} (${ticket.title}) has breached SLA. Urgent intervention required.`,
                referenceId: ticket.id,
                referenceType: 'TICKET',
              },
            });
          }

          result.escalatedL3++;
          result.details.push(`Ticket ${ticket.ticketNumber} L3 escalated (SLA Breached - Urgent alert issued)`);
        }
      }
    }

    logger.info('Escalation check completed', result);
    return result;
  }
}

export const escalationService = new EscalationService();
export default escalationService;
