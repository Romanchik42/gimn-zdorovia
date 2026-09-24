import { handleOtpRequest } from "@/lib/auth/otp-handlers";

/** POST /api/auth/email/request — выслать код на почту (GIMN-029). */
export async function POST(request: Request) {
  return handleOtpRequest(request, "email");
}
