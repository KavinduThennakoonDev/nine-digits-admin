import type { Tone } from "./status-badge";
import type { ClientStatus, LeadStatus } from "@/lib/constants";

export const CLIENT_STATUS_TONE: Record<ClientStatus, Tone> = {
  onboarding: "info", active: "success", paused: "warning", inactive: "neutral",
};

export const LEAD_STATUS_TONE: Record<LeadStatus, Tone> = {
  new: "brand", not_contacted: "neutral", contacted: "info", interested: "info", follow_up: "warning",
  negotiation: "warning", converted: "success", not_interested: "neutral", lost: "danger",
};
