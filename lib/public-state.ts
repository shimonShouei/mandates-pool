import type { PublicStanding } from "./scoring";
import type { LockReason } from "./time";

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
  euclidean: number;
  absolute: number;
  misplaced: number;
  score: number;
  thresholdCorrect: number;
  parties: {
    partyId: string;
    name: string;
    color: string;
    predicted: number;
    actual: number;
    diff: number;
    passedCall: boolean;
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

/** Public group board. No seat vector and no "you" flag. */
export type PublicStandingsPayload = {
  participantCount: number;
  completeCount: number;
  aliases: string[];
  fetchProblem: string | null;
  results: PublicResults | null;
  standings: PublicStanding[];
  thresholdBonus: number;
  partyCount: number;
  scoreable: boolean;
};

export type PublicGroupState = {
  group: {
    name: string;
    code: string;
    deadline: string | null;
    electionStart: string;
    lockAt: string;
    lockReason: LockReason;
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
  thresholdBonus: number;
  partyCount: number;
};

export type AdminParticipant = {
  alias: string;
  joinedAt: string;
  complete: boolean;
};

/** A public national-board row. No seat vector. */
export type GlobalStanding = {
  rank: number;
  alias: string;
  groupName: string;
  groupCode: string;
  euclidean: number;
  absolute: number;
  misplaced: number;
  score: number;
  thresholdCorrect: number;
  groupRank: number;
};

export type GlobalBoard = {
  page: number;
  pageSize: number;
  total: number;
  pageCount: number;
  scoreable: boolean;
  thresholdBonus: number;
  partyCount: number;
  rows: GlobalStanding[];
};
