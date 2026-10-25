import { claimDeviceIdentity } from "@/lib/claim-device";

export async function ClaimDevice() {
  await claimDeviceIdentity();
  return null;
}
