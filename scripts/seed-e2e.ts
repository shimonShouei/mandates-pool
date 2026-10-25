import { writeFileSync } from "node:fs";
import { createSqliteDb } from "../lib/db";
import { createGroup, joinGroup, listParties, saveManualResults, savePrediction } from "../lib/game";
import { pollsOpenIso } from "../lib/time";

const file = process.env.SQLITE_PATH;
if (!file) throw new Error("SQLITE_PATH is required");

const db = await createSqliteDb(file);
const parties = await listParties(db);
const group = await createGroup(db, "<script>alert(1)</script>", null, pollsOpenIso("2099-01-01"));
const alias = "<svg/onload=alert(1)>";
const person = await joinGroup(db, group.id, alias);
const seats: Record<string, number> = {};
parties.forEach((party, index) => {
  seats[party.id] = index === 0 ? 120 : 0;
});
await savePrediction(db, group.id, person.token, seats);
await saveManualResults(db, {
  seatsByPartyId: seats,
  votesByPartyId: {},
  computeFromVotes: false,
  status: "final",
  countedPercent: 100,
  turnoutPercent: null,
});

writeFileSync("/tmp/mandatim-e2e.json", JSON.stringify({ code: group.code, alias }));
console.log(`seeded ${group.code}`);
