import nodemailer from 'nodemailer';

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] as string));

export const frontendUrl = () => process.env.FRONTEND_URL || 'http://localhost:3000';

export class EmailService {
  private transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'localhost',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: false,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  });

  private send(to: string, subject: string, html: string) {
    return this.transporter.sendMail({ from: process.env.FROM_EMAIL || 'noreply@example.com', to, subject, html });
  }

  sendAccountCreationEmail(email: string, firstName: string, tempPassword: string) {
    return this.send(email, 'Compte créé - Gestionnaire de Projets Étudiants', `
      <h2>Bienvenue ${escapeHtml(firstName)}</h2>
      <p>Votre compte étudiant a été créé.</p>
      <p><strong>Email :</strong> ${escapeHtml(email)}</p>
      <p><strong>Mot de passe temporaire :</strong> ${escapeHtml(tempPassword)}</p>
      <p>Changez-le dès votre première connexion via « Mot de passe oublié ».</p>
      <p><a href="${frontendUrl()}/login">Se connecter</a></p>`);
  }

  sendProjectNotificationEmail(email: string, projectName: string, projectDescription: string) {
    return this.send(email, `Nouveau projet disponible : ${projectName}`, `
      <h2>Nouveau projet : ${escapeHtml(projectName)}</h2>
      <p>${escapeHtml(projectDescription)}</p>
      <p><a href="${frontendUrl()}/my-projects">Voir le projet</a></p>`);
  }

  sendPasswordResetEmail(email: string, firstName: string, resetToken: string) {
    return this.send(email, 'Réinitialisation de mot de passe', `
      <p>Bonjour ${escapeHtml(firstName)},</p>
      <p>Vous avez demandé la réinitialisation de votre mot de passe.</p>
      <p><a href="${frontendUrl()}/reset-password?token=${encodeURIComponent(resetToken)}">Choisir un nouveau mot de passe</a></p>
      <p>Ce lien expire dans 1 heure. Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.</p>`);
  }
}
