import nodemailer from 'nodemailer';
import twilio from 'twilio';
import { logger } from '../utils/logger.js';

export class NotificationService {
  constructor() {
    this.emailTransporter = null;
    this.twilioClient = null;
    this._initEmail();
    this._initSMS();
  }

  _initEmail() {
    try {
      if (process.env.SMTP_HOST && process.env.SMTP_USER) {
        this.emailTransporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: parseInt(process.env.SMTP_PORT) || 587,
          secure: false,
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASSWORD
          }
        });
        logger.info('Email transport initialized');
      }
    } catch (error) {
      logger.warn('Email transport not configured:', error.message);
    }
  }

  _initSMS() {
    try {
      if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
        this.twilioClient = twilio(
          process.env.TWILIO_ACCOUNT_SID,
          process.env.TWILIO_AUTH_TOKEN
        );
        logger.info('Twilio SMS client initialized');
      }
    } catch (error) {
      logger.warn('Twilio SMS not configured:', error.message);
    }
  }

  async sendVoucherConfirmationEmail({ to, clientName, voucherCode, centreName, collectionMethod, centreAddress, openingTimes }) {
    if (!this.emailTransporter) {
      logger.warn('Email not configured — skipping voucher confirmation email');
      return null;
    }

    try {
      const subject = `Foodbank Voucher Issued - ${voucherCode}`;
      const html = `
        <h2>Voucher Confirmation</h2>
        <p>Dear ${clientName},</p>
        <p>A foodbank voucher has been issued for you.</p>
        <ul>
          <li><strong>Voucher Code:</strong> ${voucherCode}</li>
          <li><strong>Centre:</strong> ${centreName}</li>
          <li><strong>Method:</strong> ${collectionMethod === 'collection' ? 'Collection' : 'Delivery'}</li>
        </ul>
        ${collectionMethod === 'collection' ? `
          <h3>Collection Details</h3>
          <p><strong>Address:</strong> ${centreAddress || 'See centre for details'}</p>
          ${openingTimes ? `<p><strong>Opening Times:</strong></p><pre>${JSON.stringify(openingTimes, null, 2)}</pre>` : ''}
        ` : `
          <p>Your parcel will be delivered. You will be contacted with delivery details.</p>
        `}
        <p>Please bring this voucher code when collecting your parcel.</p>
        <hr>
        <p><small>City of God Foodbank</small></p>
      `;

      const result = await this.emailTransporter.sendMail({
        from: process.env.EMAIL_FROM || 'noreply@foodbank.org',
        to,
        subject,
        html
      });

      logger.info('Voucher confirmation email sent', { to, voucherCode });
      return result;
    } catch (error) {
      logger.error('Error sending voucher confirmation email:', error);
      return null;
    }
  }

  async sendVoucherSMS({ to, clientName, voucherCode, centreName }) {
    if (!this.twilioClient) {
      logger.warn('Twilio not configured — skipping voucher SMS');
      return null;
    }

    try {
      const body = `Hi ${clientName}, your foodbank voucher (${voucherCode}) has been issued at ${centreName}. Please bring this code for collection. - City of God Foodbank`;

      const message = await this.twilioClient.messages.create({
        body,
        from: process.env.TWILIO_PHONE_NUMBER,
        to
      });

      logger.info('Voucher SMS sent', { to, voucherCode, sid: message.sid });
      return message;
    } catch (error) {
      logger.error('Error sending voucher SMS:', error);
      return null;
    }
  }

  async notifyVoucherIssued({ client, voucher, centre }) {
    const results = { email: null, sms: null };

    // Only send if client has contact consent
    if (!client.contact_consent) {
      logger.info('Client has not consented to contact — skipping notifications');
      return results;
    }

    if (client.email) {
      results.email = await this.sendVoucherConfirmationEmail({
        to: client.email,
        clientName: `${client.first_name} ${client.last_name}`,
        voucherCode: voucher.voucher_code,
        centreName: centre.name,
        collectionMethod: voucher.collection_method,
        centreAddress: centre.address,
        openingTimes: centre.opening_times
      });
    }

    if (client.phone) {
      results.sms = await this.sendVoucherSMS({
        to: client.phone,
        clientName: client.first_name,
        voucherCode: voucher.voucher_code,
        centreName: centre.name
      });
    }

    return results;
  }
}
