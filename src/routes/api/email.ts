import { createServerFn } from "@tanstack/react-start";
import { addPendingEmail, getPendingEmails, markEmailSent, markEmailFailed } from "~/utils/email-queue";

// Server function to queue an email for sending
export const queueEmail = createServerFn({ method: "POST" }).handler(
  async ({ data }: { data: { to: string; subject: string; body: string } }) => {
    const { to, subject, body } = data;
    if (!to || !subject || !body) {
      return { ok: false, error: "Missing required fields" };
    }
    const pending = addPendingEmail({ to, subject, body });
    return { ok: true, id: pending.id };
  },
);

// Server function to check pending emails (agent will poll this)
export const checkPendingEmails = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ emails: Array<{ id: string; to: string; subject: string; body: string }> }> => {
    const pending = getPendingEmails().filter((e) => e.status === "pending");
    return { emails: pending.map(({ id, to, subject, body }) => ({ id, to, subject, body })) };
  },
);

// Server function to mark emails as sent
export const confirmEmailSent = createServerFn({ method: "POST" }).handler(
  async ({ data }: { data: { id: string; success: boolean; error?: string } }) => {
    if (data.success) {
      markEmailSent(data.id);
    } else {
      markEmailFailed(data.id, data.error || "Unknown error");
    }
    return { ok: true };
  },
);