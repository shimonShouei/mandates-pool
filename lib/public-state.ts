import type { PublicStanding } from "./scoring";

export type { PublicStanding };

export type OfficialParty = {
  name: string;
  ballot: string;
  color: string;
  seats: number;
  votes: number | null;
  passed: boolean;
};

export type UnmappedList = {
  name: string;
  ballot: string;
  seats: number;
  votes: number | null;
};

export type PublicResults = {
  status: "provisional" | "final";
  source: "official" | "upload" | "manual";
  seatMethod: "bader-ofer" | "official-mandates" | "manual" | "incomplete";
  countedPercent: number | null;
  turnoutPercent: number | null;
  fetchedAt: string;
  scoreable: boolean;
  note: string | null;
  parties: OfficialParty[];
  unmapped: UnmappedList[];
};

export type OwnPrediction = {
  partyId: string;
  name: string;
  ballot: string;
  color: string;
  seats: number;
};

export type OwnBreakdown = {
  rank: number;
  absoluteRank: number;
  euclidean: number;
  absolute: number;
  parties: {
    partyId: string;
    name: string;
    color: string;
    predicted: number;
    actual: number;
    diff: number;
  }[];
};

export type OwnView = {
  alias: string;
  submitted: boolean;
  locked: boolean;
  total: number;
  prediction: OwnPrediction[];
  breakdown: OwnBreakdown | null;
};

export type PublicGroupState = {
  group: {
    name: string;
    code: string;
    deadline: string | null;
    locked: boolean;
    knessetNumber: number;
  };
  participantCount: number;
  completeCount: number;
  aliases: string[];
  fetchProblem: string | null;
  results: PublicResults | null;
  standings: PublicStanding[];
  own: OwnView | null;
};

export type AdminParticipant = {
  alias: string;
  joinedAt: string;
  complete: boolean;
};
