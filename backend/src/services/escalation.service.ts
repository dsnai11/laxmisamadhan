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

      // Level 3 Escalation: Breached SLA -> Reassign to Team Lead / Dept Head & Alert
      if (ticket.slaStatus === SLAStatus.BREACHED && !ticket.tags.includes('ESCALATED_L3')) {
        let targetLeaderId = ticket.department?.headId;
        const deptTeam = ticket.department?.teams?.[0];
        if (deptTeam?.leadId) targetLeaderId = deptTeam.leadId;

        await prisma.ticket.update({
          where: { id: ticket.id },
          data: {
            priority: TicketPriority.CRITICAL,
            tags: { set: Array.from(new Set([...ticket.tags, 'ESCALATED_L3'])) },
          },
        });

        if (targetLeaderId) {
          await prisma.notification.create({
            data: {
              userId: targetLeaderId,
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

    logger.info('Escalation check completed', result);
    return result;
  }
}

export const escalationService = new EscalationService();
export default escalationService;
