import { createServerFn } from "@tanstack/react-start";

const FROM_EMAIL = "lockbuilder-13afc03c@ctomail.io";

export const sendJobExport = createServerFn({ method: "POST" }).handler(
  async ({ data }: { data: { to: string; subject: string; body: string } }) => {
    const { to, subject, body } = data;
    if (!to || !subject || !body) {
      return { ok: false, error: "Missing required fields" };
    }

    try {
      // Use Bun's built-in email sending via sendEmail tool
      // For now we return the data for the client to call the sendEmail tool
      return { ok: true, message: "Ready to send", emailData: { to, subject, text: body, from: FROM_EMAIL } };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Failed to prepare email" };
    }
  },
);