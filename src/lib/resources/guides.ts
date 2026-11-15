export interface EducationalGuide {
  slug: string;
  title: string;
  summary: string;
  category: "Navigation" | "Caregiving" | "Preparation" | "Follow-Through" | "Access";
  readTime: string;
  publishedDate: string;
  keywords: string[];
  content: {
    sectionTitle: string;
    paragraphs: string[];
    actionTakeaway?: string;
  }[];
}

export const EDUCATIONAL_GUIDES: EducationalGuide[] = [
  {
    slug: "understanding-specialist-referrals",
    title: "Understanding Your Specialist Referral: From Doctor's Order to Completed Visit",
    summary:
      "A step-by-step guide to healthcare navigation when your doctor suggests a specialist. Learn how to verify in-network coverage, manage intake paperwork, and avoid scheduling delays.",
    category: "Navigation",
    readTime: "4 min read",
    publishedDate: "November 14, 2026",
    keywords: ["healthcare navigation", "specialist referral", "patient navigation", "in-network care"],
    content: [
      {
        sectionTitle: "Why Specialist Referrals Often Stall",
        paragraphs: [
          "Every year, millions of outpatient specialty referrals fail to become completed appointments. The breakdown rarely stems from clinical uncertainty; instead, it is driven by administrative friction: faxed referral sheets getting lost, outdated provider directories, and weeks of unreturned phone calls.",
          "Navigating a new referral requires understanding three key components: your health plan's network tier, whether prior authorization is needed, and whether the specialist is accepting new patients.",
        ],
        actionTakeaway: "Always request a copy of your doctor's clinical referral note and the exact NPI number of the recommended clinic.",
      },
      {
        sectionTitle: "Step 1: Verify Active In-Network Status",
        paragraphs: [
          "Insurance directories can be outdated. Before booking, call the specialist office directly and verify that they participate with your exact insurance plan tier—not just the broad insurer name.",
          "Ask: 'Are you in-network with my specific plan group, and do you require my primary care doctor to forward records before scheduling an intake slot?'",
        ],
      },
      {
        sectionTitle: "Step 2: Close the Scheduling Loop",
        paragraphs: [
          "Do not wait for the specialist clinic to call you. Proactive patient navigation means reaching out 48 hours after your referral is generated to confirm receipt and secure the earliest open slot.",
        ],
        actionTakeaway: "CareLoop automatically verifies clinic receipt and monitors open cancellation slots so you don't wait months.",
      },
    ],
  },
  {
    slug: "family-caregiver-coordination-toolkit",
    title: "The Family Caregiver's Coordination Toolkit: Managing Care for Loved Ones",
    summary:
      "Practical strategies for organizing appointments, medications, and clinical communication when balancing healthcare responsibilities for parents, children, or a partner.",
    category: "Caregiving",
    readTime: "5 min read",
    publishedDate: "November 12, 2026",
    keywords: ["caregiver support", "care coordination", "family healthcare", "healthcare organization"],
    content: [
      {
        sectionTitle: "The Unpaid Healthcare Coordinator",
        paragraphs: [
          "Caregivers often describe their role not as medical care, but as full-time project management. Between doctor visits, insurance calls, prescription refills, and transportation, the cognitive load is immense.",
          "Centralizing healthcare organization into a single shared timeline helps eliminate missed deadlines and reduces caregiver burnout.",
        ],
      },
      {
        sectionTitle: "Building a Central Care Hub",
        paragraphs: [
          "Keep a unified medication ledger that includes the drug name, exact dose, prescribing physician, and refill cadence. When multiple family members assist, shared visibility ensures doses are never duplicated or skipped.",
          "Maintain digital copies of power-of-attorney documents, photo IDs, and insurance cards in one accessible, secure vault.",
        ],
        actionTakeaway: "Use CareLoop's family dashboard to create distinct care journeys for each loved one with a shared master calendar.",
      },
      {
        sectionTitle: "Coordinating Across Transitions in Care",
        paragraphs: [
          "Transitions—such as hospital discharge to home—carry the highest risk of dropped care. Clarify discharge medication changes and schedule the post-acute follow-up visit within 7 days of arriving home.",
        ],
      },
    ],
  },
  {
    slug: "preparing-for-your-doctor-visit",
    title: "How to Prepare for Your Doctor Visit: Questions, Records, and Goals",
    summary:
      "Make the most of limited exam room time. How to structure high-priority questions, organize past records, and leave your appointment with clear, actionable next steps.",
    category: "Preparation",
    readTime: "3 min read",
    publishedDate: "November 8, 2026",
    keywords: ["healthcare appointments", "doctor preparation", "patient communication", "healthcare guidance"],
    content: [
      {
        sectionTitle: "The 15-Minute Reality",
        paragraphs: [
          "The average physician consultation lasts between 13 and 18 minutes. When patients arrive without structured discussion points, vital questions often get forgotten until after leaving the parking lot.",
          "Effective healthcare guidance begins before stepping into the clinic.",
        ],
      },
      {
        sectionTitle: "The Rule of 3 Questions",
        paragraphs: [
          "Physicians recommend prioritizing your top 3 concerns at the very beginning of the appointment. State clearly: 'Today I want to make sure we address my resting pulse changes, medication side effects, and our 6-month follow-up plan.'",
        ],
        actionTakeaway: "Write questions down in priority order so the most critical items are discussed first.",
      },
      {
        sectionTitle: "Leaving with a Defined Next Action",
        paragraphs: [
          "Before standing up to leave the exam room, ask your clinician: 'What is my single next best action, who is responsible for scheduling it, and when should we expect results?'",
        ],
      },
    ],
  },
  {
    slug: "why-healthcare-follow-through-matters",
    title: "Closing the Care Gap: Why Healthcare Follow-Through Matters",
    summary:
      "Why diagnostic orders, lab tests, and therapy referrals fall through the cracks after visits—and how proactive follow-through protects long-term health outcomes.",
    category: "Follow-Through",
    readTime: "4 min read",
    publishedDate: "November 5, 2026",
    keywords: ["healthcare follow-through", "care journey", "care completion", "healthcare organization"],
    content: [
      {
        sectionTitle: "The Execution Breakdown",
        paragraphs: [
          "Healthcare has become remarkably sophisticated at diagnosing disease and designing care plans. However, clinical studies estimate that up to 40% of ordered follow-up actions—such as blood panels, physical therapy sessions, and imaging—are never completed.",
          "This execution gap turns manageable health conditions into acute emergencies.",
        ],
      },
      {
        sectionTitle: "The Friction of Modern Healthcare",
        paragraphs: [
          "Between leaving the exam room and completing follow-up orders, patients encounter multiple separate portals, unclear prep guidelines, and unexpected billing questions. Without accountability and structured reminders, momentum stalls.",
        ],
        actionTakeaway: "Every care plan requires an active loop: clear ownership, calendar integration, and confirmation of completion.",
      },
    ],
  },
  {
    slug: "navigating-in-network-vs-out-of-network",
    title: "Demystifying Healthcare Access: In-Network vs. Out-of-Network Coverage",
    summary:
      "Clear, plain-English guidance on how provider networks operate, why directory errors occur, and how to protect yourself from unexpected out-of-network facility charges.",
    category: "Access",
    readTime: "5 min read",
    publishedDate: "November 1, 2026",
    keywords: ["healthcare access", "in-network care", "care coordination", "healthcare guidance"],
    content: [
      {
        sectionTitle: "How Provider Networks Work",
        paragraphs: [
          "An in-network provider has a negotiated fee schedule with your health insurer, capping your out-of-pocket obligation to agreed copays or coinsurance percentages.",
          "Seeing an out-of-network provider or facility can result in significantly higher deductibles and balance billing.",
        ],
      },
      {
        sectionTitle: "The Common Trap: Facility vs. Physician",
        paragraphs: [
          "Even if a physician is in-network, the hospital, surgical center, or diagnostic lab they utilize might be out-of-network. When scheduling an outpatient procedure or screening, always verify the in-network status of both the doctor and the physical facility.",
        ],
        actionTakeaway: "Ask the clinic billing department: 'Is this specific facility and provider in-network with my exact plan tier?'",
      },
    ],
  },
];
