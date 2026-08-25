import { supabase } from "@/lib/supabase/client";
import type { Meeting, MeetingParticipant } from "@/types/database";

export async function listMeetings(companyId: string): Promise<Meeting[]> {
  const { data, error } = await supabase.from("meetings").select("*").eq("company_id", companyId).order("meeting_date", { ascending: false });
  if (error) throw error;
  return data as Meeting[];
}

export async function getMeeting(id: string): Promise<Meeting> {
  const { data, error } = await supabase.from("meetings").select("*").eq("id", id).single();
  if (error) throw error;
  return data as Meeting;
}

export async function scheduleMeeting(input: {
  companyId: string; organizerId: string; title: string; meetingDate: string; startTime: string; endTime: string;
  roomId?: string | null; purpose?: string | null; agenda?: string | null; attendees?: number | null;
}): Promise<string> {
  const { data, error } = await supabase.rpc("schedule_meeting", {
    p_company_id: input.companyId, p_organizer_id: input.organizerId, p_title: input.title, p_meeting_date: input.meetingDate,
    p_start_time: input.startTime, p_end_time: input.endTime, p_room_id: input.roomId ?? null,
    p_purpose: input.purpose ?? null, p_agenda: input.agenda ?? null, p_attendees: input.attendees ?? null,
  });
  if (error) throw error;
  return data as string;
}

export async function cancelMeeting(id: string): Promise<void> {
  const { error } = await supabase.from("meetings").update({ status: "CANCELLED" }).eq("id", id);
  if (error) throw error;
}

export async function completeMeeting(id: string): Promise<void> {
  const { error } = await supabase.from("meetings").update({ status: "COMPLETED" }).eq("id", id);
  if (error) throw error;
}

export async function listMeetingParticipants(meetingId: string): Promise<MeetingParticipant[]> {
  const { data, error } = await supabase.from("meeting_participants").select("*").eq("meeting_id", meetingId);
  if (error) throw error;
  return data as MeetingParticipant[];
}

export async function addMeetingParticipant(companyId: string, meetingId: string, employeeId: string): Promise<void> {
  const { error } = await supabase.from("meeting_participants").insert({ company_id: companyId, meeting_id: meetingId, employee_id: employeeId });
  if (error) throw error;
}
