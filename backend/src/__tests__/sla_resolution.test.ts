import { describe, it, expect } from 'vitest';
import { TicketPriority, TicketCategory } from '@prisma/client';
import {
  HARDWARE_SLA_MATRIX,
  SOFTWARE_SLA_MATRIX,
  STANDARD_ESCALATION_RULES,
} from '../scripts/seed_hardware_software_sla';
import { ticketService } from '../services/ticket.service';

describe('IT Hardware & Software SLA Policies & Engine Test Suite', () => {
  describe('Hardware SLA Matrix Requirements', () => {
    it('should have exactly 20 hardware issue policies defined', () => {
      expect(HARDWARE_SLA_MATRIX).toHaveLength(20);
    });

    it('should enforce P1 Critical for Desktop / PC not working with 15m response / 4h resolution', () => {
      const pcIssue = HARDWARE_SLA_MATRIX.find((m) => m.subIssue === 'Desktop / PC not working');
      expect(pcIssue).toBeDefined();
      expect(pcIssue?.priority).toBe(TicketPriority.CRITICAL);
      expect(pcIssue?.responseTimeMins).toBe(15);
      expect(pcIssue?.resolutionTimeMins).toBe(240);
    });

    it('should enforce P1 Critical for Printer in critical department with 15m response / 2h resolution', () => {
      const critPrinter = HARDWARE_SLA_MATRIX.find(
        (m) => m.subIssue === 'Printer not working – critical department'
      );
      expect(critPrinter).toBeDefined();
      expect(critPrinter?.priority).toBe(TicketPriority.CRITICAL);
      expect(critPrinter?.responseTimeMins).toBe(15);
      expect(critPrinter?.resolutionTimeMins).toBe(120);
    });

    it('should enforce P2 High for Laptop not starting and Monitor issues', () => {
      const laptop = HARDWARE_SLA_MATRIX.find((m) => m.subIssue === 'Laptop not starting');
      expect(laptop).toBeDefined();
      expect(laptop?.priority).toBe(TicketPriority.HIGH);
      expect(laptop?.responseTimeMins).toBe(30);
      expect(laptop?.resolutionTimeMins).toBe(240);

      const monitor = HARDWARE_SLA_MATRIX.find((m) => m.subIssue === 'Monitor / Display issue');
      expect(monitor).toBeDefined();
      expect(monitor?.priority).toBe(TicketPriority.HIGH);
      expect(monitor?.responseTimeMins).toBe(30);
      expect(monitor?.resolutionTimeMins).toBe(240);
    });

    it('should enforce P3 Medium for Keyboard/Mouse and general printer issues', () => {
      const mouse = HARDWARE_SLA_MATRIX.find((m) => m.subIssue === 'Keyboard / Mouse not working');
      expect(mouse?.priority).toBe(TicketPriority.MEDIUM);
      expect(mouse?.responseTimeMins).toBe(60);
      expect(mouse?.resolutionTimeMins).toBe(480);

      const normalPrinter = HARDWARE_SLA_MATRIX.find((m) => m.subIssue === 'Printer not working – normal user');
      expect(normalPrinter?.priority).toBe(TicketPriority.MEDIUM);
      expect(normalPrinter?.responseTimeMins).toBe(60);
      expect(normalPrinter?.resolutionTimeMins).toBe(480);
    });

    it('should enforce P4 Low for Planned Hardware Installation & Asset Tagging', () => {
      const install = HARDWARE_SLA_MATRIX.find((m) => m.subIssue === 'New hardware installation');
      expect(install?.priority).toBe(TicketPriority.LOW);
      expect(install?.responseTimeMins).toBe(240);
      expect(install?.resolutionTimeMins).toBe(2880);

      const tagging = HARDWARE_SLA_MATRIX.find((m) => m.subIssue === 'Hardware inventory / Asset tagging');
      expect(tagging?.priority).toBe(TicketPriority.LOW);
      expect(tagging?.responseTimeMins).toBe(240);
      expect(tagging?.resolutionTimeMins).toBe(2880);
    });
  });

  describe('Software SLA Matrix Requirements', () => {
    it('should have 14 enterprise software systems defined', () => {
      expect(SOFTWARE_SLA_MATRIX).toHaveLength(14);
    });

    it('should enforce P1 Critical for core banking systems: LOS, LMS, CLU-collection', () => {
      const los = SOFTWARE_SLA_MATRIX.find((m) => m.subCategory.includes('LOS'));
      const lms = SOFTWARE_SLA_MATRIX.find((m) => m.subCategory.includes('LMS'));
      const clu = SOFTWARE_SLA_MATRIX.find((m) => m.subCategory.includes('CLU-collection'));

      expect(los?.priority).toBe(TicketPriority.CRITICAL);
      expect(los?.responseTimeMins).toBe(15);
      expect(los?.resolutionTimeMins).toBe(120);

      expect(lms?.priority).toBe(TicketPriority.CRITICAL);
      expect(lms?.responseTimeMins).toBe(15);
      expect(lms?.resolutionTimeMins).toBe(120);

      expect(clu?.priority).toBe(TicketPriority.CRITICAL);
      expect(clu?.responseTimeMins).toBe(15);
      expect(clu?.resolutionTimeMins).toBe(120);
    });

    it('should enforce P2 High for CRM, OS, Email/Outlook, and DSC certificates', () => {
      const crm = SOFTWARE_SLA_MATRIX.find((m) => m.subCategory === 'CRM');
      const os = SOFTWARE_SLA_MATRIX.find((m) => m.subCategory.includes('Operating System'));
      const email = SOFTWARE_SLA_MATRIX.find((m) => m.subCategory.includes('Productivity'));
      const dsc = SOFTWARE_SLA_MATRIX.find((m) => m.subCategory.includes('Browser & Portals'));

      expect(crm?.priority).toBe(TicketPriority.HIGH);
      expect(crm?.responseTimeMins).toBe(30);
      expect(crm?.resolutionTimeMins).toBe(240);

      expect(os?.priority).toBe(TicketPriority.HIGH);
      expect(email?.priority).toBe(TicketPriority.HIGH);
      expect(dsc?.priority).toBe(TicketPriority.HIGH);
    });

    it('should enforce P3 Medium for License Allocation, Permissions, and MIS Reports', () => {
      const lic = SOFTWARE_SLA_MATRIX.find((m) => m.subCategory.includes('Software Licenses'));
      const perms = SOFTWARE_SLA_MATRIX.find((m) => m.subCategory.includes('User Permissions'));
      const mis = SOFTWARE_SLA_MATRIX.find((m) => m.subCategory.includes('Reports & MIS'));

      expect(lic?.priority).toBe(TicketPriority.MEDIUM);
      expect(perms?.priority).toBe(TicketPriority.MEDIUM);
      expect(mis?.priority).toBe(TicketPriority.MEDIUM);
    });

    it('should enforce P4 Low for standard software installation requests', () => {
      const swInstall = SOFTWARE_SLA_MATRIX.find((m) => m.subCategory.includes('Software Installation'));
      expect(swInstall?.priority).toBe(TicketPriority.LOW);
      expect(swInstall?.responseTimeMins).toBe(240);
      expect(swInstall?.resolutionTimeMins).toBe(2880);
    });
  });

  describe('Standard 4-Level Escalation Chain', () => {
    it('should define a comprehensive 4-level escalation policy', () => {
      expect(STANDARD_ESCALATION_RULES).toHaveLength(4);
      expect(STANDARD_ESCALATION_RULES[0].level).toBe('L1');
      expect(STANDARD_ESCALATION_RULES[1].level).toBe('L2');
      expect(STANDARD_ESCALATION_RULES[2].level).toBe('L3');
      expect(STANDARD_ESCALATION_RULES[3].level).toBe('L4');
    });

    it('should notify L3 IT Manager at 75% resolution SLA threshold', () => {
      const l3 = STANDARD_ESCALATION_RULES.find((r) => r.level === 'L3');
      expect(l3?.description).toContain('75%');
      expect(l3?.action).toBe('notify');
    });

    it('should trigger L4 executive & OEM escalation on SLA breach', () => {
      const l4 = STANDARD_ESCALATION_RULES.find((r) => r.level === 'L4');
      expect(l4?.action).toBe('escalate');
      expect(l4?.description).toContain('breached');
    });
  });

  describe('SLA Time Calculation Unit Tests', () => {
    it('should calculate valid response and resolution due dates from an active SLA policy', () => {
      const mockPolicy: any = {
        responseTimeMins: 30,
        resolutionTimeMins: 240,
        businessHoursOnly: true,
        excludesWeekends: true,
      };

      const now = new Date();
      const times = (ticketService as any).calculateSLATimes(mockPolicy);

      expect(times.responseDueAt).toBeInstanceOf(Date);
      expect(times.resolutionDueAt).toBeInstanceOf(Date);
      expect(times.responseDueAt.getTime()).toBeGreaterThan(now.getTime());
      expect(times.resolutionDueAt.getTime()).toBeGreaterThan(times.responseDueAt.getTime());
    });
  });
});
