import { CommunicationMessageType, ReadingLevel } from "@prisma/client";

export const CANONICAL_MESSAGE_TYPES: readonly CommunicationMessageType[] = [
  CommunicationMessageType.REFERRAL_NOTIFICATION,
  CommunicationMessageType.PROVIDER_OPTIONS,
  CommunicationMessageType.SCHEDULING_REMINDER,
  CommunicationMessageType.APPOINTMENT_CONFIRMATION,
  CommunicationMessageType.APPOINTMENT_REMINDER,
  CommunicationMessageType.MISSED_APPOINTMENT,
  CommunicationMessageType.RE_ENGAGEMENT,
  CommunicationMessageType.HUMAN_OUTREACH,
  CommunicationMessageType.COMPLETION_CONFIRMATION,
];

export type LegacyOrCanonicalPurpose =
  | CommunicationMessageType
  | "INITIAL_OUTREACH"
  | "SCHEDULING_ASSIST"
  | "APPOINTMENT_REMINDER"
  | "MISSED_VISIT_FOLLOWUP"
  | "COVERAGE_CLARIFICATION";

export function normalizeCommunicationMessageType(
  purpose?: LegacyOrCanonicalPurpose | string | null
): CommunicationMessageType {
  switch (purpose) {
    case "REFERRAL_NOTIFICATION":
    case "INITIAL_OUTREACH":
      return CommunicationMessageType.REFERRAL_NOTIFICATION;
    case "PROVIDER_OPTIONS":
    case "SCHEDULING_ASSIST":
      return CommunicationMessageType.PROVIDER_OPTIONS;
    case "SCHEDULING_REMINDER":
      return CommunicationMessageType.SCHEDULING_REMINDER;
    case "APPOINTMENT_CONFIRMATION":
      return CommunicationMessageType.APPOINTMENT_CONFIRMATION;
    case "APPOINTMENT_REMINDER":
      return CommunicationMessageType.APPOINTMENT_REMINDER;
    case "MISSED_APPOINTMENT":
    case "MISSED_VISIT_FOLLOWUP":
      return CommunicationMessageType.MISSED_APPOINTMENT;
    case "RE_ENGAGEMENT":
      return CommunicationMessageType.RE_ENGAGEMENT;
    case "COMPLETION_CONFIRMATION":
      return CommunicationMessageType.COMPLETION_CONFIRMATION;
    case "HUMAN_OUTREACH":
    case "COVERAGE_CLARIFICATION":
    default:
      return CommunicationMessageType.HUMAN_OUTREACH;
  }
}

export interface RenderTemplateInput {
  messageType: CommunicationMessageType;
  language: string;
  readingLevel: ReadingLevel;
  memberFirstName: string;
  specialty: string;
  networkRequired?: string;
  providerCount?: number;
  availableThisWeekCount?: number;
  providerName?: string | null;
  appointmentDateText?: string | null;
}

export interface RenderedCommunicationTemplate {
  templateKey: string;
  messageType: CommunicationMessageType;
  language: string;
  readingLevel: ReadingLevel;
  subject: string;
  body: string;
}

export function renderCommunicationTemplate(
  input: RenderTemplateInput
): RenderedCommunicationTemplate {
  const isSpanish = input.language.toLowerCase().startsWith("span");
  const langKey = isSpanish ? "es" : "en";
  const levelKey = input.readingLevel.toLowerCase();
  const templateKey = `${input.messageType.toLowerCase()}.${langKey}.${levelKey}`;

  const first = input.memberFirstName;
  const prov = input.providerName ?? (isSpanish ? "su proveedor" : "your provider");
  const dateClause = input.appointmentDateText
    ? isSpanish
      ? ` el ${input.appointmentDateText}`
      : ` on ${input.appointmentDateText}`
    : "";
  const count = input.providerCount ?? 3;
  const thisWeek = input.availableThisWeekCount ?? 2;
  const plan = input.networkRequired ?? (isSpanish ? "su seguro" : "your insurance");

  let subject = isSpanish ? `Apoyo para su cita de ${input.specialty}` : `Help setting up your ${input.specialty} visit`;
  let body = "";

  if (isSpanish) {
    switch (input.messageType) {
      case "REFERRAL_NOTIFICATION":
        body =
          input.readingLevel === "SIMPLE"
            ? `Hola ${first}. Tiene una referencia para ${input.specialty}. Encontramos ${count} opciones que aceptan ${plan}. ¿Le ayudamos a elegir horario?`
            : input.readingLevel === "STANDARD"
              ? `Hola ${first}, usted fue referido para ${input.specialty}. Encontramos ${count} proveedores cerca de usted que aceptan ${plan}, y ${thisWeek} tienen citas disponibles esta semana. Podemos ayudarle a elegir y confirmar su visita.`
              : `Hola ${first}, usted fue referido para ${input.specialty}. Encontramos ${count} proveedores que aceptan ${plan}. ${thisWeek} tienen citas esta semana.`;
        subject = "Su referencia de atención";
        break;
      case "PROVIDER_OPTIONS":
        body =
          input.readingLevel === "SIMPLE"
            ? `Hola ${first}. Tenemos ${count} proveedores disponibles en su idioma que aceptan ${plan}. Responda para ver horarios.`
            : `Hola ${first}, encontramos ${count} proveedores cerca de usted para ${input.specialty} que aceptan ${plan}. ${thisWeek} tienen horarios esta semana. Dinos qué día prefiere.`;
        subject = "Opciones de proveedores para usted";
        break;
      case "SCHEDULING_REMINDER":
        body =
          input.readingLevel === "SIMPLE"
            ? `Hola ${first}. Todavía tenemos su referencia lista para ${input.specialty}. ¿Qué día le queda bien?`
            : `Hola ${first}, le recordamos que estamos listos para ayudarle a programar su cita de ${input.specialty} sin costo ni estrés adicional. Responda con su mejor horario.`;
        subject = "Recordatorio amable para programar su cita";
        break;
      case "APPOINTMENT_CONFIRMATION":
        body = `Hola ${first}, su cita con ${prov}${dateClause} ha sido confirmada. Si necesita cambiar la hora o ayuda con transporte, avísenos.`;
        subject = "Cita confirmada";
        break;
      case "APPOINTMENT_REMINDER":
        body =
          input.readingLevel === "SIMPLE"
            ? `Hola ${first}. Recordatorio: su cita con ${prov}${dateClause}. Avísenos si necesita transporte.`
            : `Hola ${first}, le recordamos su próxima cita con ${prov}${dateClause}. Si necesita ayuda con transporte o desea cambiar el horario, estamos aquí para ayudarle.`;
        subject = "Recordatorio de su cita";
        break;
      case "MISSED_APPOINTMENT":
        body = `Hola ${first}, notamos que no pudo asistir a su cita de ${input.specialty}. Entendemos que surgen imprevistos y queremos ayudarle a encontrar otro horario o cita por video.`;
        subject = "Queremos ayudarle a reprogramar";
        break;
      case "RE_ENGAGEMENT":
        body = `Hola ${first}, seguimos aquí para ayudarle cuando esté listo para retomar su cita de ${input.specialty}. Responda este mensaje si desea explorar opciones flexibles.`;
        subject = "Seguimos aquí para apoyarle";
        break;
      case "COMPLETION_CONFIRMATION":
        body = `Hola ${first}, ¡nos alegra saber que completó su visita de ${input.specialty}! Cuéntenos si necesita ayuda con una próxima cita.`;
        subject = "¡Gracias por completar su visita!";
        break;
      case "HUMAN_OUTREACH":
      default:
        body = `Hola ${first}, un coordinador de nuestro equipo quiere conversar con usted brevemente para ayudarle con su visita de ${input.specialty} y responder cualquier duda sobre ${plan}.`;
        subject = "Un coordinador de atención está aquí para ayudarle";
        break;
    }
  } else {
    switch (input.messageType) {
      case "REFERRAL_NOTIFICATION":
        body =
          input.readingLevel === "SIMPLE"
            ? `Hi ${first}. You were referred for ${input.specialty}. We found ${count} providers who take ${plan}. Reply to pick a time.`
            : input.readingLevel === "STANDARD"
              ? `Hi ${first}, you were referred to behavioral healthcare (${input.specialty}). We found ${count} providers near you who accept ${plan}. ${thisWeek} currently have appointments available this week, and our care team is happy to help schedule what works best for you.`
              : `Hi ${first}, you were referred to behavioral healthcare. We found ${count} providers near you who accept your insurance (${plan}). ${thisWeek} currently have appointments available this week.`;
        subject = "Your care referral and local provider options";
        break;
      case "PROVIDER_OPTIONS":
        body =
          input.readingLevel === "SIMPLE"
            ? `Hi ${first}. ${count} ${input.specialty} providers take ${plan}. ${thisWeek} have openings this week. Which day works for you?`
            : `Hi ${first}, we put together ${count} ${input.specialty} provider choices covered by ${plan} (including telehealth and your preferred language options). Let us know which option or time works best for your schedule.`;
        subject = "Provider choices available for you";
        break;
      case "SCHEDULING_REMINDER":
        body =
          input.readingLevel === "SIMPLE"
            ? `Hi ${first}. We can help book your ${input.specialty} visit whenever you are ready. What day is best?`
            : `Hi ${first}, friendly check-in from your care coordination team—your ${input.specialty} referral is ready to schedule. Tell us what days work best or ask if you want a video visit.`;
        subject = "Ready to pick a time for your visit?";
        break;
      case "APPOINTMENT_CONFIRMATION":
        body =
          input.readingLevel === "SIMPLE"
            ? `Hi ${first}. Your visit with ${prov}${dateClause} is confirmed. Let us know if anything changes.`
            : `Hi ${first}, your ${input.specialty} appointment with ${prov}${dateClause} is confirmed! Reply anytime if you need directions, a video link check, or transportation support.`;
        subject = "Your appointment is confirmed";
        break;
      case "APPOINTMENT_REMINDER":
        body =
          input.readingLevel === "SIMPLE"
            ? `Hi ${first}. Reminder: appointment with ${prov}${dateClause}. Need a ride or new time? Tell us.`
            : `Hi ${first}, this is a friendly reminder about your upcoming ${input.specialty} visit with ${prov}${dateClause}. Reach out if you need transportation help or a different time.`;
        subject = "Friendly reminder: your upcoming visit";
        break;
      case "MISSED_APPOINTMENT":
        body =
          input.readingLevel === "SIMPLE"
            ? `Hi ${first}. Sorry we missed you recently. Want help picking a new time or a video visit?`
            : `Hi ${first}, we noticed we missed you at your recent ${input.specialty} appointment. Life gets busy—we are here with zero judgment to help pick a better day or switch to a video visit from home.`;
        subject = "Let's find a new time that works for you";
        break;
      case "RE_ENGAGEMENT":
        body =
          input.readingLevel === "SIMPLE"
            ? `Hi ${first}. We are still here to help set up your ${input.specialty} visit when you are ready.`
            : `Hi ${first}, your care coordination team is checking in softly—whenever you are ready, we can help with scheduling, insurance questions, or rides for your ${input.specialty} visit.`;
        subject = "Here to help whenever you're ready";
        break;
      case "COMPLETION_CONFIRMATION":
        body =
          input.readingLevel === "SIMPLE"
            ? `Hi ${first}. Glad you made it to your visit with ${prov}! Let us know if you need anything else.`
            : `Hi ${first}, thank you for completing your first ${input.specialty} visit with ${prov}. Tell us if you need help setting up your next visit or have any questions about logistics.`;
        subject = "Glad you connected with your provider";
        break;
      case "HUMAN_OUTREACH":
      default:
        body =
          input.readingLevel === "SIMPLE"
            ? `Hi ${first}. A care coordinator wants to call and help with your ${input.specialty} visit. When can we call?`
            : `Hi ${first}, a Care Coordinator from your support team would like to give you a quick call to help answer questions about ${plan} and find a convenient ${input.specialty} appointment.`;
        subject = "A care coordinator would like to help";
        break;
    }
  }

  return {
    templateKey,
    messageType: input.messageType,
    language: input.language,
    readingLevel: input.readingLevel,
    subject,
    body,
  };
}
