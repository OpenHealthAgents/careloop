import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const WaitlistSchema = z.object({
  fullName: z.string().trim().min(2, "Full name must be at least 2 characters").max(100),
  email: z.string().trim().email("Please enter a valid email address"),
  roleType: z.enum([
    "SELF",
    "PARENT_OR_FAMILY",
    "CHRONIC_CARE",
    "SPECIALIST_COORDINATION",
    "OTHER",
  ]),
  primaryBarrier: z
    .enum([
      "FINDING_SPECIALIST",
      "SCHEDULING_WAIT",
      "INSURANCE_COST",
      "UNDERSTANDING_REFERRAL",
      "TRANSPORT_LOGISTICS",
      "MULTIPLE_PROVIDERS",
    ])
    .optional(),
  stateLocation: z.string().trim().max(50).optional(),
  currentCareChallenge: z.string().trim().max(1000).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = WaitlistSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Validation failed",
          details: result.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { fullName, email, roleType, primaryBarrier } = result.data;

    // Generate a calm personalized confirmation plan summary
    const confirmationId = `CL-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    return NextResponse.json({
      success: true,
      confirmationId,
      message: "You're in the loop. We will reach out shortly to guide your next care action.",
      carePlanSummary: {
        for: fullName,
        email,
        audience: roleType,
        focusBarrier: primaryBarrier || "COMPREHENSIVE_NAVIGATION",
        assignedStep: "UNDERSTAND",
        nextAction: "Personalized Care Navigation Roadmap will be unlocked in your welcome email.",
      },
    });
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid request payload" },
      { status: 400 }
    );
  }
}
