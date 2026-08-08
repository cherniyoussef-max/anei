import "dotenv/config";
import nodemailer from "nodemailer";

const host = process.env.SMTP_HOST?.trim();
const port = Number(process.env.SMTP_PORT ?? "587");
const user = process.env.SMTP_USER?.trim();
const pass = process.env.SMTP_PASS?.trim();

if (!host || !user || !pass || !Number.isInteger(port) || port <= 0) {
  throw new Error("SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASS must be configured before verifying SMTP.");
}

const transporter = nodemailer.createTransport({
  host,
  port,
  secure: process.env.SMTP_SECURE === "true",
  auth: { user, pass },
  connectionTimeout: 10_000,
  greetingTimeout: 10_000,
  socketTimeout: 20_000,
});

async function main() {
  await transporter.verify();
  console.log("SMTP connection and credentials verified. No email was sent.");
}

main().catch((error: unknown) => {
  const details = error as { code?: string; responseCode?: number; response?: string };
  if (details.responseCode === 525 || /unauthorized ip/i.test(details.response ?? "")) {
    console.error("SMTP verification failed: Brevo rejected this server's public IP address. Add the IP to Brevo's authorized-IP settings, then try again.");
  } else if (details.code === "EAUTH") {
    console.error("SMTP verification failed: Brevo rejected the SMTP credentials. Check SMTP_USER is your Brevo account email and SMTP_PASS is an SMTP key, not your account password.");
  } else if (details.code === "ETIMEDOUT" || details.code === "ECONNREFUSED") {
    console.error("SMTP verification failed: the SMTP server could not be reached. Check network/firewall access to smtp-relay.brevo.com:587.");
  } else {
    console.error("SMTP verification failed. Check the Brevo SMTP key, account email, host/port, and network access. No secrets were printed.");
  }
  process.exitCode = 1;
});
