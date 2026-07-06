declare module 'nodemailer' {
    export interface SendMailOptions {
        from?: string;
        to?: string | string[];
        subject?: string;
        text?: string;
        html?: string;
        cc?: string | string[];
        bcc?: string | string[];
        replyTo?: string;
        attachments?: any[];
    }

    export interface Transporter {
        sendMail(options: SendMailOptions): Promise<any>;
        verify(): Promise<boolean>;
    }

    export function createTransport(config: any): Transporter;

    const nodemailer: {
        createTransport(config: any): Transporter;
    };

    export default nodemailer;
}
