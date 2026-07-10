import nodemailer from "nodemailer";

function transporter() {
  if (!process.env.SMTP_HOST) throw new Error("SMTP_HOST is not configured.");
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || "false") === "true",
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined
  });
}

async function send(message) {
  try {
    await transporter().sendMail({ from: process.env.SMTP_FROM || process.env.SMTP_USER, ...message });
    return true;
  } catch (error) {
    console.error("Email delivery failed:", error.message);
    return false;
  }
}

export function notifyAdminOfRegistration({ name, email }) {
  const to = process.env.ADMIN_NOTIFICATION_EMAIL || process.env.ADMIN_EMAIL;
  if (!to) return Promise.resolve(false);
  return send({ to, subject: `Nova solicitação BioO3: ${name}`, text: `A clínica ${name} (${email}) aguarda aprovação no painel administrativo.` });
}

export function notifyClinicDecision({ name, email, approved, reason }) {
  return send({
    to: email,
    subject: approved ? "Cadastro BioO3 aprovado" : "Cadastro BioO3 não aprovado",
    text: approved
      ? `Olá, ${name}. Seu acesso ao BioO3 foi aprovado e já está disponível.`
      : `Olá, ${name}. Sua solicitação não foi aprovada. Motivo: ${reason}`
  });
}
