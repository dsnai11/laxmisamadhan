import nodemailer from 'nodemailer';
import config from '@config/index';
import logger from '@utils/logger';

interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    contentType?: string;
  }>;
}

class EmailService {
  private transporter: nodemailer.Transporter | null = null;
  private initialized = false;

  private initialize() {
    if (this.initialized) return;

    const host = (config.email.host || '').replace(/^["']|["']$/g, '').trim();
    const user = (config.email.user || '').replace(/^["']|["']$/g, '').trim();
    const pass = (config.email.pass || '').replace(/^["']|["']$/g, '').trim();
    const port = config.email.port || 587;

    logger.info('Initializing Email Service transporter', {
      host,
      port,
      user,
      secure: port === 465,
    });

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: {
        user,
        pass,
      },
      tls: {
        rejectUnauthorized: false,
      },
      connectionTimeout: 20000,
      greetingTimeout: 20000,
      socketTimeout: 30000,
      pool: false,
    });

    this.transporter.verify((error) => {
      if (error) {
        logger.error('Email service verification failed', { error: error.message });
      } else {
        logger.info('Email service ready');
      }
    });

    this.initialized = true;
  }

  async sendEmail(options: EmailOptions): Promise<boolean> {
    this.initialize();

    if (!this.transporter) {
      logger.error('Email transporter not initialized');
      return false;
    }

    try {
      const recipients = Array.isArray(options.to) ? options.to.join(', ') : options.to;
      const fromAddress = (config.email.from || 'IT Service Desk <laxmisamadhan@lifc.in>').replace(/^["']|["']$/g, '').trim();

      const info = await this.transporter.sendMail({
        from: fromAddress,
        to: recipients,
        subject: options.subject,
        html: options.html,
        text: options.text || this.htmlToText(options.html),
        attachments: options.attachments,
      });

      logger.info('Email sent successfully', {
        to: recipients,
        subject: options.subject,
        messageId: info?.messageId,
      });
      return true;
    } catch (error) {
      logger.error('Failed to send email', {
        error: error instanceof Error ? error.message : 'Unknown error',
        to: options.to,
        subject: options.subject,
      });
      return false;
    }
  }

  private htmlToText(html: string): string {
    return html
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&/g, '&')
      .replace(/</g, '<')
      .replace(/>/g, '>')
      .trim();
  }

  private getEmailWrapper(title: string, subtitle: string, contentHtml: string): string {
    const portalUrl = config.frontendUrl || 'https://laxmisamadhan.lifc.in';
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; color: #1f2937;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f3f4f6; padding: 24px 12px;">
          <tr>
            <td align="center">
              <table role="presentation" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.06); border: 1px solid #e5e7eb;" cellspacing="0" cellpadding="0">
                <!-- Header -->
                <tr>
                  <td style="background: linear-gradient(135deg, #7f1d1d 0%, #991b1b 100%); padding: 28px 32px; text-align: center;">
                    <h1 style="margin: 0; color: #ffffff; font-size: 22px; font-weight: 700; letter-spacing: 0.5px;">Laxmi India Finance Ltd</h1>
                    <p style="margin: 6px 0 0; color: #fecaca; font-size: 13px; font-weight: 500; letter-spacing: 0.25px;">Laxmi Samadhan &bull; IT Service Desk</p>
                  </td>
                </tr>
                <!-- Body -->
                <tr>
                  <td style="padding: 32px 32px 28px;">
                    <h2 style="margin: 0 0 8px; color: #111827; font-size: 20px; font-weight: 700;">${title}</h2>
                    ${subtitle ? `<p style="margin: 0 0 24px; color: #4b5563; font-size: 14px; line-height: 1.5;">${subtitle}</p>` : '<div style="margin-bottom: 20px;"></div>'}
                    ${contentHtml}
                  </td>
                </tr>
                <!-- Footer -->
                <tr>
                  <td style="background-color: #f9fafb; padding: 20px 32px; text-align: center; border-top: 1px solid #e5e7eb;">
                    <p style="margin: 0; color: #6b7280; font-size: 12px; line-height: 1.5;">
                      Laxmi India Finance Ltd &bull; IT Service Desk &bull; <a href="${portalUrl}" style="color: #7f1d1d; text-decoration: underline; font-weight: 600;">Access Portal</a>
                    </p>
                    <p style="margin: 6px 0 0; color: #9ca3af; font-size: 11px;">
                      This is an automated system notification from Laxmi Samadhan. Please do not reply directly to this email.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;
  }

  async sendTicketCreatedEmail(
    to: string,
    ticketNumber: string,
    title: string,
    portalUrl: string,
    departmentName?: string,
    priority?: string
  ): Promise<boolean> {
    const ticketUrl = `${portalUrl}/tickets/${ticketNumber}`;
    const content = `
      <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 18px 20px; margin-bottom: 24px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
          <tr>
            <td style="padding-bottom: 8px; font-size: 13px; color: #6b7280;">Ticket Number:</td>
            <td style="padding-bottom: 8px; font-size: 14px; font-weight: 700; color: #7f1d1d; text-align: right;">${ticketNumber}</td>
          </tr>
          <tr>
            <td style="padding-bottom: 8px; font-size: 13px; color: #6b7280;">Subject:</td>
            <td style="padding-bottom: 8px; font-size: 14px; font-weight: 600; color: #111827; text-align: right;">${title}</td>
          </tr>
          ${departmentName ? `
            <tr>
              <td style="padding-bottom: 8px; font-size: 13px; color: #6b7280;">Department:</td>
              <td style="padding-bottom: 8px; font-size: 13px; color: #111827; text-align: right;">${departmentName}</td>
            </tr>
          ` : ''}
          ${priority ? `
            <tr>
              <td style="font-size: 13px; color: #6b7280;">Priority:</td>
              <td style="font-size: 13px; font-weight: 600; color: #b91c1c; text-align: right;">${priority}</td>
            </tr>
          ` : ''}
        </table>
      </div>
      <p style="margin: 0 0 24px; font-size: 14px; color: #4b5563; line-height: 1.5;">
        Your ticket has been logged in the system. Our support team will review and address your request according to the designated service level agreement (SLA).
      </p>
      <div style="text-align: center; margin: 28px 0;">
        <a href="${ticketUrl}" style="display: inline-block; background-color: #7f1d1d; color: #ffffff; padding: 13px 28px; text-decoration: none; border-radius: 6px; font-size: 14px; font-weight: 600; letter-spacing: 0.3px;">View Ticket Details</a>
      </div>
    `;

    return this.sendEmail({
      to,
      subject: `[${ticketNumber}] Ticket Created: ${title}`,
      html: this.getEmailWrapper('New Ticket Created', 'Your support ticket has been received by the IT Service Desk.', content),
    });
  }

  async sendTicketAssignedEmail(
    to: string,
    ticketNumber: string,
    title: string,
    assigneeName: string,
    portalUrl: string,
    priority?: string
  ): Promise<boolean> {
    const ticketUrl = `${portalUrl}/tickets/${ticketNumber}`;
    const content = `
      <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 18px 20px; margin-bottom: 24px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
          <tr>
            <td style="padding-bottom: 8px; font-size: 13px; color: #6b7280;">Ticket Number:</td>
            <td style="padding-bottom: 8px; font-size: 14px; font-weight: 700; color: #7f1d1d; text-align: right;">${ticketNumber}</td>
          </tr>
          <tr>
            <td style="padding-bottom: 8px; font-size: 13px; color: #6b7280;">Title:</td>
            <td style="padding-bottom: 8px; font-size: 14px; font-weight: 600; color: #111827; text-align: right;">${title}</td>
          </tr>
          <tr>
            <td style="padding-bottom: 8px; font-size: 13px; color: #6b7280;">Assigned By:</td>
            <td style="padding-bottom: 8px; font-size: 13px; color: #111827; text-align: right;">${assigneeName}</td>
          </tr>
          ${priority ? `
            <tr>
              <td style="font-size: 13px; color: #6b7280;">Priority:</td>
              <td style="font-size: 13px; font-weight: 600; color: #b91c1c; text-align: right;">${priority}</td>
            </tr>
          ` : ''}
        </table>
      </div>
      <p style="margin: 0 0 24px; font-size: 14px; color: #4b5563; line-height: 1.5;">
        You have been assigned as the owner of this ticket. Please review the ticket details and begin troubleshooting within the SLA response window.
      </p>
      <div style="text-align: center; margin: 28px 0;">
        <a href="${ticketUrl}" style="display: inline-block; background-color: #7f1d1d; color: #ffffff; padding: 13px 28px; text-decoration: none; border-radius: 6px; font-size: 14px; font-weight: 600;">Open Assigned Ticket</a>
      </div>
    `;

    return this.sendEmail({
      to,
      subject: `[Assigned] ${ticketNumber} - ${title}`,
      html: this.getEmailWrapper('Ticket Assigned to You', 'You have been assigned a new support ticket.', content),
    });
  }

  async sendTicketResolvedEmail(
    to: string,
    ticketNumber: string,
    title: string,
    resolution: string,
    portalUrl: string
  ): Promise<boolean> {
    const ticketUrl = `${portalUrl}/tickets/${ticketNumber}`;
    const content = `
      <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 18px 20px; margin-bottom: 24px;">
        <p style="margin: 0 0 8px; font-size: 14px; font-weight: 700; color: #166534;">${ticketNumber} &bull; ${title}</p>
        <p style="margin: 0 0 6px; font-size: 13px; color: #374151;"><strong>Resolution Summary:</strong></p>
        <p style="margin: 0; font-size: 13px; color: #1f2937; line-height: 1.5; background: #ffffff; padding: 10px 12px; border-radius: 4px; border: 1px solid #dcfce7;">
          ${resolution || 'The requested issue has been resolved by our IT Support team.'}
        </p>
      </div>
      <p style="margin: 0 0 24px; font-size: 14px; color: #4b5563; line-height: 1.5;">
        If your issue has been completely addressed, no further action is required. If you are still experiencing issues, you may reopen this ticket directly from the portal within 48 hours.
      </p>
      <div style="text-align: center; margin: 28px 0;">
        <a href="${ticketUrl}" style="display: inline-block; background-color: #166534; color: #ffffff; padding: 13px 28px; text-decoration: none; border-radius: 6px; font-size: 14px; font-weight: 600;">View Resolution & Rate Support</a>
      </div>
    `;

    return this.sendEmail({
      to,
      subject: `[Resolved] ${ticketNumber} - ${title}`,
      html: this.getEmailWrapper('Ticket Resolved', 'Your support request has been marked as resolved.', content),
    });
  }

  async sendSLAWarningEmail(
    to: string,
    ticketNumber: string,
    title: string,
    timeRemaining: string,
    portalUrl: string
  ): Promise<boolean> {
    const ticketUrl = `${portalUrl}/tickets/${ticketNumber}`;
    const content = `
      <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; padding: 18px 20px; margin-bottom: 24px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
          <tr>
            <td style="padding-bottom: 8px; font-size: 13px; color: #991b1b; font-weight: 600;">Ticket:</td>
            <td style="padding-bottom: 8px; font-size: 14px; font-weight: 700; color: #991b1b; text-align: right;">${ticketNumber}</td>
          </tr>
          <tr>
            <td style="padding-bottom: 8px; font-size: 13px; color: #991b1b;">Title:</td>
            <td style="padding-bottom: 8px; font-size: 13px; color: #111827; text-align: right;">${title}</td>
          </tr>
          <tr>
            <td style="font-size: 13px; color: #991b1b; font-weight: 600;">Status:</td>
            <td style="font-size: 13px; font-weight: 700; color: #dc2626; text-align: right;">${timeRemaining || 'Approaching SLA Breach'}</td>
          </tr>
        </table>
      </div>
      <p style="margin: 0 0 24px; font-size: 14px; color: #4b5563; line-height: 1.5;">
        This ticket is at risk of breaching its SLA target. Immediate action or escalation is required to ensure timely resolution.
      </p>
      <div style="text-align: center; margin: 28px 0;">
        <a href="${ticketUrl}" style="display: inline-block; background-color: #dc2626; color: #ffffff; padding: 13px 28px; text-decoration: none; border-radius: 6px; font-size: 14px; font-weight: 600;">Take Immediate Action</a>
      </div>
    `;

    return this.sendEmail({
      to,
      subject: `⚠️ [SLA Warning] ${ticketNumber} - ${title}`,
      html: this.getEmailWrapper('SLA Breach Warning', 'A ticket under your responsibility is approaching SLA breach.', content),
    });
  }

  async sendApprovalRequestEmail(
    to: string,
    ticketNumber: string,
    title: string,
    approverName: string,
    portalUrl: string
  ): Promise<boolean> {
    const approvalUrl = `${portalUrl}/tickets/${ticketNumber}`;
    const content = `
      <div style="background-color: #fdf4ff; border: 1px solid #f0abfc; border-radius: 6px; padding: 18px 20px; margin-bottom: 24px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
          <tr>
            <td style="padding-bottom: 8px; font-size: 13px; color: #6b7280;">Ticket Number:</td>
            <td style="padding-bottom: 8px; font-size: 14px; font-weight: 700; color: #7f1d1d; text-align: right;">${ticketNumber}</td>
          </tr>
          <tr>
            <td style="padding-bottom: 8px; font-size: 13px; color: #6b7280;">Ticket Title:</td>
            <td style="padding-bottom: 8px; font-size: 13px; color: #111827; text-align: right;">${title}</td>
          </tr>
          <tr>
            <td style="font-size: 13px; color: #6b7280;">Requested By:</td>
            <td style="font-size: 13px; color: #111827; text-align: right;">${approverName}</td>
          </tr>
        </table>
      </div>
      <p style="margin: 0 0 24px; font-size: 14px; color: #4b5563; line-height: 1.5;">
        A formal approval has been requested for this ticket. Please click below to review the request and approve or reject it.
      </p>
      <div style="text-align: center; margin: 28px 0;">
        <a href="${approvalUrl}" style="display: inline-block; background-color: #701a75; color: #ffffff; padding: 13px 28px; text-decoration: none; border-radius: 6px; font-size: 14px; font-weight: 600;">Review & Approve</a>
      </div>
    `;

    return this.sendEmail({
      to,
      subject: `[Action Required] Approval Request: ${ticketNumber} - ${title}`,
      html: this.getEmailWrapper('Approval Required', 'Your authorization is required to proceed with this request.', content),
    });
  }

  async sendApprovalDecisionEmail(
    to: string,
    ticketNumber: string,
    title: string,
    decision: 'APPROVED' | 'REJECTED',
    approverName: string,
    comment?: string,
    portalUrl?: string
  ): Promise<boolean> {
    const isApproved = decision === 'APPROVED';
    const ticketUrl = `${portalUrl || config.frontendUrl}/tickets/${ticketNumber}`;
    const content = `
      <div style="background-color: ${isApproved ? '#f0fdf4' : '#fef2f2'}; border: 1px solid ${isApproved ? '#bbf7d0' : '#fecaca'}; border-radius: 6px; padding: 18px 20px; margin-bottom: 24px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
          <tr>
            <td style="padding-bottom: 8px; font-size: 13px; color: #6b7280;">Ticket:</td>
            <td style="padding-bottom: 8px; font-size: 14px; font-weight: 700; color: #111827; text-align: right;">${ticketNumber}</td>
          </tr>
          <tr>
            <td style="padding-bottom: 8px; font-size: 13px; color: #6b7280;">Decision:</td>
            <td style="padding-bottom: 8px; font-size: 14px; font-weight: 700; color: ${isApproved ? '#166534' : '#991b1b'}; text-align: right;">${isApproved ? 'APPROVED' : 'REJECTED'}</td>
          </tr>
          <tr>
            <td style="font-size: 13px; color: #6b7280;">Reviewed By:</td>
            <td style="font-size: 13px; color: #111827; text-align: right;">${approverName}</td>
          </tr>
        </table>
        ${comment ? `
          <div style="margin-top: 12px; padding-top: 12px; border-top: 1px dashed ${isApproved ? '#bbf7d0' : '#fecaca'};">
            <p style="margin: 0 0 4px; font-size: 12px; color: #6b7280; font-weight: 600;">Approver Comments:</p>
            <p style="margin: 0; font-size: 13px; color: #1f2937;">${comment}</p>
          </div>
        ` : ''}
      </div>
      <div style="text-align: center; margin: 28px 0;">
        <a href="${ticketUrl}" style="display: inline-block; background-color: #7f1d1d; color: #ffffff; padding: 13px 28px; text-decoration: none; border-radius: 6px; font-size: 14px; font-weight: 600;">View Ticket</a>
      </div>
    `;

    return this.sendEmail({
      to,
      subject: `[${isApproved ? 'Approved' : 'Rejected'}] Approval Request: ${ticketNumber}`,
      html: this.getEmailWrapper(`Approval ${isApproved ? 'Granted' : 'Denied'}`, `An approval decision has been made for ticket ${ticketNumber}.`, content),
    });
  }

  async sendPasswordResetEmail(to: string, resetLink: string): Promise<boolean> {
    const content = `
      <p style="margin: 0 0 20px; font-size: 14px; color: #374151; line-height: 1.6;">
        We received a request to reset the password for your Laxmi Samadhan account. Click the button below to choose a new password:
      </p>
      <div style="text-align: center; margin: 32px 0;">
        <a href="${resetLink}" style="display: inline-block; background-color: #7f1d1d; color: #ffffff; padding: 14px 36px; text-decoration: none; border-radius: 6px; font-size: 15px; font-weight: 600; letter-spacing: 0.3px;">Reset My Password</a>
      </div>
      <div style="background-color: #fffbeb; border: 1px solid #fef3c7; border-radius: 6px; padding: 14px 18px; margin-top: 24px;">
        <p style="margin: 0; color: #92400e; font-size: 13px; line-height: 1.5;">
          <strong>Security Note:</strong> This reset link is valid for <strong>1 hour</strong> and can only be used once. If you did not request a password reset, please ignore this email; your account remains secure.
        </p>
      </div>
    `;

    return this.sendEmail({
      to,
      subject: 'IT Service Desk — Password Reset Request',
      html: this.getEmailWrapper('Password Reset Request', 'Follow the instructions below to reset your password.', content),
    });
  }

  async sendPasswordChangedEmail(to: string, firstName: string): Promise<boolean> {
    const content = `
      <p style="margin: 0 0 16px; font-size: 14px; color: #374151; line-height: 1.6;">
        Hello <strong>${firstName || 'User'}</strong>,
      </p>
      <p style="margin: 0 0 20px; font-size: 14px; color: #374151; line-height: 1.6;">
        The password for your Laxmi Samadhan account was successfully updated on <strong>${new Date().toUTCString()}</strong>.
      </p>
      <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; padding: 14px 18px; margin-top: 16px;">
        <p style="margin: 0; color: #991b1b; font-size: 13px; line-height: 1.5;">
          <strong>Notice:</strong> If you did not authorize this change, please report it immediately to your IT Administrator or contact IT Security.
        </p>
      </div>
    `;

    return this.sendEmail({
      to,
      subject: 'Security Alert: Password Changed Successfully',
      html: this.getEmailWrapper('Password Changed', 'Your account security credentials were updated.', content),
    });
  }

  async sendWelcomeEmail(to: string, firstName: string, portalUrl: string, temporaryPassword?: string): Promise<boolean> {
    const content = `
      <p style="margin: 0 0 16px; font-size: 14px; color: #374151; line-height: 1.6;">
        Hello <strong>${firstName || 'there'}</strong>,
      </p>
      <p style="margin: 0 0 20px; font-size: 14px; color: #374151; line-height: 1.6;">
        Your Laxmi Samadhan account has been created. You can now log into the IT Service Desk to raise tickets, track requests, and access IT support.
      </p>
      ${temporaryPassword ? `
        <div style="background-color: #fef3c7; border: 1px solid #fde68a; border-radius: 6px; padding: 16px 20px; margin-bottom: 24px;">
          <p style="margin: 0 0 8px; font-size: 12px; font-weight: 600; color: #92400e; text-transform: uppercase;">Temporary Password</p>
          <code style="font-family: monospace; font-size: 16px; font-weight: 700; color: #1f2937; background: #ffffff; padding: 6px 14px; border-radius: 4px; border: 1px solid #e5e7eb; display: inline-block; letter-spacing: 1px;">${temporaryPassword}</code>
          <p style="margin: 10px 0 0; font-size: 12px; color: #92400e;">You will be asked to choose a new password upon your first login.</p>
        </div>
      ` : ''}
      <div style="text-align: center; margin: 28px 0;">
        <a href="${portalUrl}" style="display: inline-block; background-color: #7f1d1d; color: #ffffff; padding: 14px 36px; text-decoration: none; border-radius: 6px; font-size: 15px; font-weight: 600;">Access IT Service Desk</a>
      </div>
    `;

    return this.sendEmail({
      to,
      subject: 'Welcome to Laxmi India Finance Ltd — IT Service Desk',
      html: this.getEmailWrapper('Welcome to IT Service Desk', 'Your account is ready for use.', content),
    });
  }

  async sendMFASetupEmail(to: string, secret: string, qrCodeUrl: string): Promise<boolean> {
    const content = `
      <p style="margin: 0 0 16px; font-size: 14px; color: #374151; line-height: 1.6;">
        Scan the QR code below with your authenticator app (Google Authenticator, Microsoft Authenticator, or Authy):
      </p>
      <div style="text-align: center; margin: 24px 0;">
        <img src="${qrCodeUrl}" alt="MFA QR Code" style="max-width: 200px; border: 1px solid #e5e7eb; border-radius: 8px; padding: 8px; background: #ffffff;" />
      </div>
      <p style="margin: 0 0 8px; font-size: 13px; color: #6b7280;">Manual Setup Secret Key:</p>
      <code style="display: inline-block; background: #f3f4f6; padding: 6px 12px; border-radius: 4px; font-family: monospace; font-size: 14px; letter-spacing: 1px;">${secret}</code>
      <p style="margin: 16px 0 0; color: #6b7280; font-size: 13px;">Enter the 6-digit verification code to complete two-factor authentication setup.</p>
    `;

    return this.sendEmail({
      to,
      subject: 'Set Up Two-Factor Authentication',
      html: this.getEmailWrapper('Two-Factor Authentication Setup', 'Enhance your account security with MFA.', content),
    });
  }
}

export const emailService = new EmailService();
export default emailService;