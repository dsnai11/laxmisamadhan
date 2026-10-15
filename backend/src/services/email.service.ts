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
    
    logger.info('Initializing Email Service transporter', {
      host: config.email.host,
      port: config.email.port,
      user: config.email.user,
      secure: config.email.port === 465,
    });

    this.transporter = nodemailer.createTransport({
      host: config.email.host,
      port: config.email.port,
      secure: config.email.port === 465,
      auth: {
        user: config.email.user,
        pass: config.email.pass,
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
      
      await this.transporter.sendMail({
        from: config.email.from,
        to: recipients,
        subject: options.subject,
        html: options.html,
        text: options.text || this.htmlToText(options.html),
        attachments: options.attachments,
      });

      logger.info('Email sent successfully', { to: recipients, subject: options.subject });
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

  async sendTicketCreatedEmail(to: string, ticketNumber: string, title: string, portalUrl: string): Promise<boolean> {
    return this.sendEmail({
      to,
      subject: `New Ticket Created: ${ticketNumber} - ${title}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1e40af;">New Ticket Created</h2>
          <p>A new ticket has been created in the IT Ticketing Portal.</p>
          <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
            <p><strong>Ticket Number:</strong> ${ticketNumber}</p>
            <p><strong>Title:</strong> ${title}</p>
          </div>
          <a href="${portalUrl}/tickets/${ticketNumber}" style="display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">View Ticket</a>
        </div>
      `,
    });
  }

  async sendTicketAssignedEmail(to: string, ticketNumber: string, title: string, assigneeName: string, portalUrl: string): Promise<boolean> {
    return this.sendEmail({
      to,
      subject: `Ticket Assigned: ${ticketNumber} - ${title}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1e40af;">Ticket Assigned to You</h2>
          <p>You have been assigned to a new ticket.</p>
          <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
            <p><strong>Ticket Number:</strong> ${ticketNumber}</p>
            <p><strong>Title:</strong> ${title}</p>
            <p><strong>Assigned by:</strong> ${assigneeName}</p>
          </div>
          <a href="${portalUrl}/tickets/${ticketNumber}" style="display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">View Ticket</a>
        </div>
      `,
    });
  }

  async sendTicketResolvedEmail(to: string, ticketNumber: string, title: string, resolution: string, portalUrl: string): Promise<boolean> {
    return this.sendEmail({
      to,
      subject: `Ticket Resolved: ${ticketNumber} - ${title}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #059669;">Ticket Resolved</h2>
          <p>Your ticket has been resolved.</p>
          <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
            <p><strong>Ticket Number:</strong> ${ticketNumber}</p>
            <p><strong>Title:</strong> ${title}</p>
            <p><strong>Resolution:</strong> ${resolution}</p>
          </div>
          <a href="${portalUrl}/tickets/${ticketNumber}" style="display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">View Ticket</a>
        </div>
      `,
    });
  }

  async sendSLAWarningEmail(to: string, ticketNumber: string, title: string, timeRemaining: string, portalUrl: string): Promise<boolean> {
    return this.sendEmail({
      to,
      subject: `⚠️ SLA Warning: ${ticketNumber} - ${title}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #dc2626;">SLA Breach Warning</h2>
          <p>The following ticket is approaching its SLA deadline.</p>
          <div style="background: #fef2f2; border: 1px solid #fecaca; padding: 16px; border-radius: 8px; margin: 16px 0;">
            <p><strong>Ticket Number:</strong> ${ticketNumber}</p>
            <p><strong>Title:</strong> ${title}</p>
            <p><strong>Time Remaining:</strong> ${timeRemaining}</p>
          </div>
          <a href="${portalUrl}/tickets/${ticketNumber}" style="display: inline-block; background: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">Take Action</a>
        </div>
      `,
    });
  }

  async sendApprovalRequestEmail(to: string, ticketNumber: string, title: string, approverName: string, portalUrl: string): Promise<boolean> {
    return this.sendEmail({
      to,
      subject: `Approval Required: ${ticketNumber} - ${title}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #7c3aed;">Approval Required</h2>
          <p>Your approval is required for the following ticket.</p>
          <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
            <p><strong>Ticket Number:</strong> ${ticketNumber}</p>
            <p><strong>Title:</strong> ${title}</p>
            <p><strong>Requested by:</strong> ${approverName}</p>
          </div>
          <a href="${portalUrl}/tickets/${ticketNumber}/approval" style="display: inline-block; background: #7c3aed; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">Review Approval</a>
        </div>
      `,
    });
  }

  async sendMFASetupEmail(to: string, secret: string, qrCodeUrl: string): Promise<boolean> {
    return this.sendEmail({
      to,
      subject: 'Set Up Two-Factor Authentication',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1e40af;">Two-Factor Authentication Setup</h2>
          <p>Scan the QR code below with your authenticator app (Google Authenticator, Authy, etc.)</p>
          <div style="text-align: center; margin: 24px 0;">
            <img src="${qrCodeUrl}" alt="MFA QR Code" style="max-width: 200px; border: 1px solid #e5e7eb; border-radius: 8px;" />
          </div>
          <p><strong>Secret Key:</strong> <code style="background: #f3f4f6; padding: 4px 8px; border-radius: 4px;">${secret}</code></p>
          <p style="color: #6b7280; font-size: 14px;">Enter the 6-digit code from your authenticator app to complete setup.</p>
        </div>
      `,
    });
  }

  async sendPasswordResetEmail(to: string, resetLink: string): Promise<boolean> {
    return this.sendEmail({
      to,
      subject: 'IT Service Desk — Password Reset Request',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f9fafb; padding: 24px;">
          <div style="background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.08);">
            <div style="background: #7f1d1d; padding: 24px 32px; text-align: center;">
              <p style="margin: 0; color: #ffffff; font-size: 20px; font-weight: 700; letter-spacing: 0.5px;">Laxmi India Finance Ltd</p>
              <p style="margin: 4px 0 0; color: #fca5a5; font-size: 13px;">IT Service Desk</p>
            </div>
            <div style="padding: 32px;">
              <h2 style="margin: 0 0 12px; color: #111827; font-size: 20px;">Password Reset Request</h2>
              <p style="color: #374151; margin: 0 0 24px;">We received a request to reset the password for your IT Service Desk account. Click the button below to set a new password.</p>
              <div style="text-align: center; margin: 28px 0;">
                <a href="${resetLink}" style="display: inline-block; background: #7f1d1d; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-size: 15px; font-weight: 600;">Reset My Password</a>
              </div>
              <div style="background: #fef9f0; border: 1px solid #fed7aa; border-radius: 6px; padding: 14px 18px; margin-top: 24px;">
                <p style="margin: 0; color: #92400e; font-size: 13px;"><strong>Important:</strong> This link is valid for <strong>1 hour</strong> and can only be used once. After use, it will expire immediately.</p>
              </div>
              <p style="color: #6b7280; font-size: 13px; margin-top: 20px;">If you did not request this password reset, please ignore this email. Your password will remain unchanged.</p>
            </div>
            <div style="background: #f3f4f6; padding: 16px 32px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; color: #9ca3af; font-size: 12px;">Laxmi India Finance Ltd &bull; IT Service Desk &bull; <a href="${config.frontendUrl}" style="color: #6b7280;">Portal</a></p>
              <p style="margin: 4px 0 0; color: #d1d5db; font-size: 11px;">Do not reply to this email. This is an automated message.</p>
            </div>
          </div>
        </div>
      `,
    });
  }

  async sendWelcomeEmail(to: string, firstName: string, portalUrl: string, temporaryPassword?: string): Promise<boolean> {
    return this.sendEmail({
      to,
      subject: 'Welcome to Laxmi India Finance Ltd — IT Service Desk',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f9fafb; padding: 24px;">
          <div style="background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.08);">
            <div style="background: #7f1d1d; padding: 24px 32px; text-align: center;">
              <p style="margin: 0; color: #ffffff; font-size: 20px; font-weight: 700; letter-spacing: 0.5px;">Laxmi India Finance Ltd</p>
              <p style="margin: 4px 0 0; color: #fca5a5; font-size: 13px;">IT Service Desk</p>
            </div>
            <div style="padding: 32px;">
              <h2 style="margin: 0 0 12px; color: #111827; font-size: 20px;">Welcome, ${firstName}!</h2>
              <p style="color: #374151; margin: 0 0 16px;">Your IT Service Desk account has been created. You can now log in and raise support tickets.</p>
              ${temporaryPassword ? `
                <div style="background: #fef3c7; border: 1px solid #fcd34d; padding: 16px; border-radius: 8px; margin: 16px 0;">
                  <p style="margin: 0 0 8px;"><strong>Temporary Password:</strong></p>
                  <code style="background: #f3f4f6; padding: 6px 12px; border-radius: 4px; font-size: 15px; letter-spacing: 1px;">${temporaryPassword}</code>
                  <p style="color: #92400e; font-size: 13px; margin: 10px 0 0;">You will be prompted to change this on first login.</p>
                </div>
              ` : ''}
              <div style="text-align: center; margin: 28px 0;">
                <a href="${portalUrl}" style="display: inline-block; background: #7f1d1d; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-size: 15px; font-weight: 600;">Access IT Service Desk</a>
              </div>
            </div>
            <div style="background: #f3f4f6; padding: 16px 32px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; color: #9ca3af; font-size: 12px;">Laxmi India Finance Ltd &bull; IT Service Desk</p>
              <p style="margin: 4px 0 0; color: #d1d5db; font-size: 11px;">Do not reply to this email. This is an automated message.</p>
            </div>
          </div>
        </div>
      `,
    });
  }
}

export const emailService = new EmailService();
export default emailService;