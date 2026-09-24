import { handleOtpRequest } from "@/lib/auth/otp-handlers";

/** POST /api/auth/sms/request — выслать код на телефон (GIMN-029). */
export async function POST(request: Request) {
  return handleOtpRequest(request, "sms");
}
