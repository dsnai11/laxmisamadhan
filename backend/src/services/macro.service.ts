import { prisma } from '@config/prisma';
import { createLogger } from '@utils/logger';
import { TicketStatus, TicketPriority } from '@prisma/client';
import ticketService from './ticket.service';

const logger = createLogger('macro-service');

export interface MacroDefinition {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  comment?: string;
  isInternalComment?: boolean;
  newStatus?: TicketStatus;
  newPriority?: TicketPriority;
  addTags?: string[];
  requiresResolutionNote?: boolean;
}

export const PRESET_MACROS: MacroDefinition[] = [
  {
    id: 'macro-password-reset',
    name: 'Request Password Reset Info',
    description: 'Ask client for Employee ID & verification code, set status to Dependency on client',
    icon: 'key',
    category: 'Authentication',
    comment: 'Dear User,\n\nTo proceed with your password reset request, please reply with your Employee ID and verified mobile number for identity verification.\n\nThank you,\nIT Support Desk',
    isInternalComment: false,
    newStatus: TicketStatus.DEPENDENCY_ON_CLIENT,
    addTags: ['password-reset', 'client-action-required'],
  },
  {
    id: 'macro-hardware-diag',
    name: 'Hardware Diagnostic Request',
    description: 'Request device diagnostic log screenshot and set ticket to Dependency on client',
    icon: 'laptop',
    category: 'IT Hardware',
    comment: 'Dear User,\n\nPlease run the hardware diagnostic utility on your machine (Win + R -> mdsched.exe or Device Manager) and reply with a screenshot of the diagnostic results.\n\nThank you,\nHardware Support Team',
    isInternalComment: false,
    newStatus: TicketStatus.DEPENDENCY_ON_CLIENT,
    addTags: ['hardware-diag', 'dependency-on-client'],
  },
  {
    id: 'macro-security-containment',
    name: 'Security Incident Containment',
    description: 'Upgrade priority to CRITICAL, set Open, and tag security-incident',
    icon: 'shield',
    category: 'Security',
    comment: 'SECURITY ALERT: Incident containment procedures initiated. Device isolation and credential audit in progress.',
    isInternalComment: true,
    newStatus: TicketStatus.OPEN,
    newPriority: TicketPriority.CRITICAL,
    addTags: ['security-incident', 'containment-active', 'high-priority'],
  },
  {
    id: 'macro-quick-resolve',
    name: 'Standard Resolution & Close Notice',
    description: 'Post resolution notice and set status to RESOLVED',
    icon: 'check',
    category: 'General',
    comment: 'The reported issue has been resolved according to standard operating procedures. Please verify functionality at your end.',
    isInternalComment: false,
    newStatus: TicketStatus.RESOLVED,
    addTags: ['resolved-via-macro'],
    requiresResolutionNote: true,
  },
];

class MacroService {
  async getMacros(): Promise<MacroDefinition[]> {
    return PRESET_MACROS;
  }

  async applyMacro(ticketId: string, macroId: string, userId: string, userRole: any, resolutionText?: string): Promise<any> {
    const macro = PRESET_MACROS.find(m => m.id === macroId);
    if (!macro) throw new Error('Macro not found');

    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) throw new Error('Ticket not found');

    // 1. Post comment if defined
    if (macro.comment) {
      await ticketService.addComment(
        ticketId,
        userId,
        macro.comment,
        !!macro.isInternalComment,
        undefined,
        undefined,
        userRole
      );
    }

    // 2. Update status if defined
    if (macro.newStatus) {
      await ticketService.updateStatus(
        ticketId,
        macro.newStatus,
        userId,
        userRole,
        resolutionText || macro.comment || 'Resolved via agent macro',
        'Resolved via macro'
      );
    }

    // 3. Update priority or tags if defined
    const updateData: any = {};
    if (macro.newPriority) updateData.priority = macro.newPriority;
    if (macro.addTags && macro.addTags.length > 0) {
      const existingTags = ticket.tags || [];
      updateData.tags = { set: Array.from(new Set([...existingTags, ...macro.addTags])) };
    }

    if (Object.keys(updateData).length > 0) {
      await prisma.ticket.update({
        where: { id: ticketId },
        data: updateData,
      });
    }

    logger.info('Applied macro to ticket', { ticketId, macroId, userId });
    return { success: true, macroName: macro.name };
  }
}

export const macroService = new MacroService();
export default macroService;
