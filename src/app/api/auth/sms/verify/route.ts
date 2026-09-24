import { handleOtpVerify } from "@/lib/auth/otp-handlers";

/** POST /api/auth/sms/verify — проверить код и открыть сессию (GIMN-029). */
export async function POST(request: Request) {
  return handleOtpVerify(request, "sms");
}
