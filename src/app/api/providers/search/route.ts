import { NextResponse } from "next/server";
import { z } from "zod";
import { rankProvidersForReferral } from "@/domain/matching/provider-matcher";
import { PERMISSIONS } from "@/lib/auth/rbac";
import { requireRequestContext, toErrorResponse } from "@/lib/auth/request-context";
import { providerRepository } from "@/repositories/provider-repository";

const SearchProvidersSchema = z.object({
  specialty: z.string().default(""),
  behavioralHealthNeed: z.string().optional(),
  network: z.string().default("UNKNOWN"),
  geography: z.string().default(""),
  language: z.string().default(""),
  preferredModality: z.enum(["ANY", "TELEHEALTH", "IN_PERSON"]).default("ANY"),
  verifiedOnly: z.boolean().default(false),
});

export async function POST(request: Request) {
  try {
    const { session } = await requireRequestContext(request, PERMISSIONS.PROVIDERS_READ);
    const body = SearchProvidersSchema.parse(await request.json());

    const providers = await providerRepository.listWithAvailabilities(session.tenantId);
    let matches = rankProvidersForReferral(
      providers.map((p) => ({ ...p, verifiedSlots: p.availabilities })),
      {
        referralSpecialty: body.specialty,
        behavioralHealthNeed: body.behavioralHealthNeed,
        referralNetwork: body.network,
        referralGeography: body.geography,
        preferredLanguage: body.language,
        preferredModality: body.preferredModality,
      }
    );

    if (body.verifiedOnly) {
      matches = matches.filter((m) => m.availabilityLabel === "VERIFIED AVAILABILITY");
    }

    return NextResponse.json({
      matches,
      totalCandidates: providers.length,
      returnedCount: matches.length,
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
