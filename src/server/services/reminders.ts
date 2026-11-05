import "server-only";
import { connectDB } from "../db/connect";
import { Lead } from "../db/models/lead";
import { Invoice } from "../db/models/invoice";
import { Project } from "../db/models/project";
import { Client } from "../db/models/client";
import { Settings } from "../db/models/settings";
import { notify, usersWith } from "./notify";
import { OPEN_PROJECT_STATUSES } from "@/lib/constants";
import { getClosedLeadStatuses } from "./lead-statuses";
import { formatDateTime, formatDay, startOfAgencyDay } from "@/lib/format";
import { formatMoney } from "@/lib/money";

const HOUR = 3_600_000;

/**
 * Generates time-based reminders (follow-ups due/overdue, overdue invoices,
 * upcoming project deadlines). Idempotent: every reminder has a dedupe key.
 */
export async function runReminders(now = new Date()) {
  await connectDB();
  const counts = { followupDue: 0, followupOverdue: 0, invoiceOverdue: 0, projectDeadline: 0 };
  const leadAssigners = await usersWith("leads.assign");

  // Follow-ups: due within 24h, and overdue (open, active leads only).
  const leads = await Lead.find({
    deletedAt: null, archivedAt: null, status: { $nin: await getClosedLeadStatuses() }, nextFollowUpAt: { $ne: null, $lte: new Date(now.getTime() + 24 * HOUR) },
  }, { fullName: 1, nextFollowUpAt: 1, assignedTo: 1 }).limit(2000).lean();
  for (const l of leads) {
    const at = l.nextFollowUpAt!;
    const overdue = at < now;
    const recipients = l.assignedTo ? [l.assignedTo] : leadAssigners;
    await notify({
      type: overdue ? "followup_overdue" : "followup_due",
      userIds: recipients,
      title: overdue ? `Follow-up overdue: ${l.fullName}` : `Follow-up due: ${l.fullName}`,
      body: `${overdue ? "Was due" : "Due"} ${formatDateTime(at)}`,
      link: `/leads/${l._id}`,
      dedupe: (u) => `${overdue ? "followup_overdue" : "followup_due"}:${l._id}:${at.getTime()}:${u}`,
    });
    counts[overdue ? "followupOverdue" : "followupDue"]++;
  }

  // Overdue invoices → people who see finance.
  const finance = await usersWith("finance.view");
  if (finance.length) {
    const invoices = await Invoice.find({ deletedAt: null, status: { $in: ["sent", "partial"] }, dueDate: { $lt: startOfAgencyDay(now) } },
      { number: 1, clientId: 1, total: 1, amountPaid: 1, currency: 1, dueDate: 1 }).limit(1000).lean();
    const clients = await Client.find({ _id: { $in: invoices.map((i) => i.clientId) } }, { clientName: 1 }).lean();
    const names = new Map(clients.map((c) => [String(c._id), c.clientName]));
    for (const i of invoices) {
      await notify({
        type: "invoice_overdue", userIds: finance,
        title: `Invoice ${i.number} is overdue`,
        body: `${names.get(String(i.clientId)) ?? "Client"} owes ${formatMoney(i.total - i.amountPaid, i.currency as "LKR" | "USD")} (due ${formatDay(i.dueDate)})`,
        link: `/finance/invoices/${i._id}`,
        dedupe: (u) => `invoice_overdue:${i._id}:${i.dueDate.getTime()}:${u}`,
      });
      counts.invoiceOverdue++;
    }
  }

  // Project deadlines within 3 days → manager and members.
  const projects = await Project.find({
    deletedAt: null, status: { $in: OPEN_PROJECT_STATUSES }, deadline: { $gte: startOfAgencyDay(now), $lte: new Date(now.getTime() + 72 * HOUR) },
  }, { name: 1, deadline: 1, managerId: 1, memberIds: 1 }).lean();
  for (const p of projects) {
    await notify({
      type: "project_deadline", userIds: [p.managerId, ...p.memberIds],
      title: `Deadline approaching: ${p.name}`, body: `Due ${formatDay(p.deadline)}`, link: `/projects/${p._id}`,
      dedupe: (u) => `project_deadline:${p._id}:${p.deadline!.getTime()}:${u}`,
    });
    counts.projectDeadline++;
  }

  await Settings.updateOne({ key: "global" }, { $set: { remindersSweptAt: now } });
  return counts;
}

/** Runs the sweep at most every `minutes` (claims the slot atomically so concurrent requests don't double up). */
export async function maybeRunReminders(minutes = 10) {
  await connectDB();
  const cutoff = new Date(Date.now() - minutes * 60_000);
  const claimed = await Settings.findOneAndUpdate(
    { key: "global", $or: [{ remindersSweptAt: null }, { remindersSweptAt: { $lt: cutoff } }] },
    { $set: { remindersSweptAt: new Date() } },
  ).lean();
  if (claimed) await runReminders();
}
