import nodemailer from 'nodemailer';

export class EmailService {
    private static transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.ethereal.email',
        port: parseInt(process.env.SMTP_PORT || '587'),
        auth: {
            user: process.env.SMTP_USER || 'ethereal_user',
            pass: process.env.SMTP_PASS || 'ethereal_pass'
        }
    });

    static async sendOTP(email: string, code: string, name: string) {
        const mailOptions = {
            from: '"MOSA Security" <security@mosa.iq>',
            to: email,
            subject: 'MOSA - رمز إعادة تعيين كلمة المرور',
            html: `
                <div style="font-family: Arial, sans-serif; text-align: right; dir: rtl;">
                    <h2>مرحباً ${name}،</h2>
                    <p>لقد طلبت إعادة تعيين كلمة المرور لحسابك في منصة MOSA الذكية.</p>
                    <div style="background-color: #f3f4f6; padding: 20px; border-radius: 10px; font-size: 24px; font-weight: bold; letter-spacing: 5px; text-align: center; margin: 20px 0;">
                        ${code}
                    </div>
                    <p>هذا الرمز صالح لمدة 15 دقيقة فقط.</p>
                    <p>إذا لم تقم بطلب هذا الرمز، يرجى تجاهل هذه الرسالة.</p>
                </div>
            `
        };

        try {
            await this.transporter.sendMail(mailOptions);
            return true;
        } catch (error) {
            console.error('Email send failed:', error);
            return false; // In production, throw error or alert admin
        }
    }

    static async sendWelcomeEmail(email: string, name: string) {
        const mailOptions = {
            from: '"MOSA Smart Home" <welcome@mosa.iq>',
            to: email,
            subject: 'مرحباً بك في نظام MOSA للمنازل الذكية 🚀',
            html: `
                <div style="font-family: Arial, sans-serif; text-align: right; dir: rtl;">
                    <h2>أهلاً بك ${name} 🎉</h2>
                    <p>سعداء بانضمامك إلى منصة MOSA لإدارة المنازل الذكية.</p>
                    <p>الآن أصبحت جاهزاً لتحويل منزلك إلى منزل ذكي بالكامل. يمكنك البدء بإنشاء غرفتك الأولى وإضافة الأجهزة.</p>
                    <br>
                    <a href="http://app.mosa.iq" style="background-color: #3b82f6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">دخول لوحة التحكم</a>
                    <br><br>
                    <p>إذا احتجت إلى أية مساعدة، لا تتردد في مراسلتنا.</p>
                    <p>فريق MOSA 💙</p>
                </div>
            `
        };

        try {
            await this.transporter.sendMail(mailOptions);
            return true;
        } catch (error) {
            console.error('Welcome email failed:', error);
            return false;
        }
    }
}
