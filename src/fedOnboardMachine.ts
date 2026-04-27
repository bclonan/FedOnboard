import { assign, setup } from "xstate";

/**
 * FedOnboard main machine
 * - deterministic + idempotent action intents
 * - clearance-path branching (suitability/public trust/national security)
 * - unified data sync projections (least exposure by role)
 * - human-in-the-loop approval gates for sensitive actions
 *
 * NOTE:
 * This is a configurable workflow scaffold for demo/MVP use.
 * Agency policies and legal requirements must be configured externally.
 */

export type ClearancePath =
  | "NON_SENSITIVE"
  | "PUBLIC_TRUST_MODERATE"
  | "PUBLIC_TRUST_HIGH"
  | "NATIONAL_SECURITY_SECRET"
  | "NATIONAL_SECURITY_TOP_SECRET";

export type Role =
  | "candidate"
  | "hr"
  | "security"
  | "it"
  | "office_poc"
  | "admin";

export type ActionStatus =
  | "Queued"
  | "AwaitingHumanApproval"
  | "Approved"
  | "Rejected"
  | "Executed"
  | "Failed";

export type DocumentType =
  | "OF_306"
  | "I_9"
  | "DIRECT_DEPOSIT"
  | "SF_85"
  | "SF_85P"
  | "SF_86"
  | "FINGERPRINT_RECEIPT"
  | "ID_FRONT"
  | "ID_BACK"
  | "PIV_PICKUP_CONFIRMATION"
  | "ETHICS_CERT"
  | "OGE_450"
  | "OGE_278E"
  | "OTHER";

export type ExposureClass =
  | "public_process"
  | "candidate_private"
  | "security_sensitive"
  | "hr_confidential"
  | "admin_internal";

export interface ScopeRecord {
  scopeId: string;
  agency: string;
  roleTitle: string;
  payPlan: string;
  grade: string;
  dutyStation: string;
  sensitivityLevel: string;
  clearancePath: ClearancePath;
  currentState: string;
  currentPhase: string;
  createdAt: string;
  updatedAt: string;
}

export interface CandidateProfile {
  candidateId: string;
  displayName: string;
  email: string;
  phone?: string;
}

export interface OnboardingDocument {
  id: string;
  type: DocumentType;
  status: "requested" | "received" | "verified" | "rejected";
  exposureClass: ExposureClass;
  requestedAt?: string;
  receivedAt?: string;
  verifiedAt?: string;
  source?: "email" | "upload" | "api" | "manual";
}

export interface Task {
  taskId: string;
  title: string;
  owner: Role;
  dueAt?: string;
  status:
    | "pending"
    | "in_progress"
    | "awaiting_review"
    | "completed"
    | "blocked";
  blocksProgress: boolean;
}

export interface IdempotentAction {
  actionId: string;
  idempotencyKey: string;
  type:
    | "REQUEST_DOCUMENT"
    | "DRAFT_EMAIL"
    | "SEND_EMAIL"
    | "CREATE_TASK"
    | "SCHEDULE_EVENT"
    | "WRITE_SYNC_VIEW"
    | "ADVANCE_STATE"
    | "CREATE_RECEIPT"
    | "REQUEST_REFERENCE_CALL"
    | "LOG_REFERENCE_RESPONSE";
  status: ActionStatus;
  input: Record<string, unknown>;
  output?: Record<string, unknown>;
  requiresHumanApproval: boolean;
  createdAt: string;
}

export interface Receipt {
  receiptId: string;
  actionId: string;
  previousHash?: string;
  payloadHash: string;
  receiptHash: string;
  actor: "system" | "human";
  at: string;
  beforeState: string;
  afterState: string;
}

export interface InvestigationReference {
  referenceId: string;
  referenceType:
    | "supervisor"
    | "coworker"
    | "personal"
    | "residence"
    | "education";
  name: string;
  status: "pending" | "requested" | "responded" | "verified";
  mockQuestionSet: string[];
  responseSummary?: string;
}

export interface ClearanceConfig {
  requiresFingerprinting: boolean;
  suitabilityForm: "SF_85" | "SF_85P" | "SF_86";
  requiresNationalSecurityQuestionnaire: boolean;
  requiresInterimReview: boolean;
  requiredDocs: DocumentType[];
  backgroundReferenceTypes: InvestigationReference["referenceType"][];
}

export interface RoleSyncView {
  syncViewId: string;
  role: Role;
  visibleFields: Record<string, unknown>;
  redactedFields: string[];
  allowedActions: string[];
  projectionHash: string;
  writtenAt: string;
}

export interface FedOnboardContext {
  scope: ScopeRecord;
  candidate: CandidateProfile;

  clearanceConfig: ClearanceConfig;

  documents: Record<string, OnboardingDocument>;
  tasks: Record<string, Task>;
  references: Record<string, InvestigationReference>;

  queuedActions: IdempotentAction[];
  receipts: Receipt[];

  riskFlags: string[];
  lastError?: string;

  finalOffer?: {
    receivedAt?: string;
    acceptedAt?: string;
    eodDate?: string;
  };

  postStart?: {
    p4pStarted?: boolean;
    pivReady?: boolean;
    pivPickedUp?: boolean;
    equipmentReceived?: boolean;
    orientationDone?: boolean;
    ethicsCompleted?: boolean;
    disclosureRequired?: boolean;
    disclosureSubmitted?: boolean;
  };
}

export type FedOnboardEvent =
  | { type: "INIT_SCOPE"; input: Partial<FedOnboardContext> }
  | { type: "TJO_ACCEPTED" }
  | { type: "CLASSIFICATION_CONFIRMED"; clearancePath: ClearancePath }
  | { type: "ENROLLMENT_EMAIL_RECEIVED" }
  | {
      type: "FINGERPRINT_APPOINTMENT_SET";
      startsAt: string;
      location: string;
    }
  | { type: "VISITOR_CLEARANCE_CONFIRMED" }
  | { type: "FINGERPRINTS_COMPLETED" }
  | { type: "QUESTIONNAIRE_LINK_RECEIVED" }
  | { type: "QUESTIONNAIRE_SUBMITTED" }
  | { type: "REFERENCE_REQUESTS_CREATED" }
  | { type: "REFERENCE_RESPONSES_LOGGED" }
  | { type: "INTERIM_GRANTED" }
  | { type: "FULLY_CLEARED" }
  | { type: "FINAL_OFFER_RECEIVED"; at: string }
  | { type: "FINAL_OFFER_ACCEPTED"; at: string; eodDate: string }
  | { type: "P4P_RECEIVED" }
  | { type: "PIV_READY" }
  | { type: "PIV_PICKED_UP" }
  | { type: "EQUIPMENT_RECEIVED" }
  | { type: "ORIENTATION_DONE" }
  | { type: "ETHICS_DONE" }
  | { type: "DISCLOSURE_REQUIRED" }
  | { type: "DISCLOSURE_SUBMITTED" }
  | { type: "HUMAN_APPROVED_ACTION"; actionId: string }
  | { type: "HUMAN_REJECTED_ACTION"; actionId: string; reason: string }
  | { type: "ACTION_EXECUTED"; actionId: string }
  | { type: "ACTION_FAILED"; actionId: string; reason: string }
  | { type: "RETRY" };

const CLEARANCE_PATH_CONFIG: Record<ClearancePath, ClearanceConfig> = {
  NON_SENSITIVE: {
    requiresFingerprinting: true,
    suitabilityForm: "SF_85",
    requiresNationalSecurityQuestionnaire: false,
    requiresInterimReview: false,
    requiredDocs: ["OF_306", "I_9", "DIRECT_DEPOSIT", "SF_85"],
    backgroundReferenceTypes: ["supervisor", "personal"],
  },
  PUBLIC_TRUST_MODERATE: {
    requiresFingerprinting: true,
    suitabilityForm: "SF_85P",
    requiresNationalSecurityQuestionnaire: false,
    requiresInterimReview: true,
    requiredDocs: ["OF_306", "I_9", "DIRECT_DEPOSIT", "SF_85P"],
    backgroundReferenceTypes: ["supervisor", "coworker", "residence"],
  },
  PUBLIC_TRUST_HIGH: {
    requiresFingerprinting: true,
    suitabilityForm: "SF_85P",
    requiresNationalSecurityQuestionnaire: false,
    requiresInterimReview: true,
    requiredDocs: ["OF_306", "I_9", "DIRECT_DEPOSIT", "SF_85P"],
    backgroundReferenceTypes: ["supervisor", "coworker", "residence", "education"],
  },
  NATIONAL_SECURITY_SECRET: {
    requiresFingerprinting: true,
    suitabilityForm: "SF_86",
    requiresNationalSecurityQuestionnaire: true,
    requiresInterimReview: true,
    requiredDocs: ["OF_306", "I_9", "DIRECT_DEPOSIT", "SF_86"],
    backgroundReferenceTypes: ["supervisor", "coworker", "personal", "residence", "education"],
  },
  NATIONAL_SECURITY_TOP_SECRET: {
    requiresFingerprinting: true,
    suitabilityForm: "SF_86",
    requiresNationalSecurityQuestionnaire: true,
    requiresInterimReview: true,
    requiredDocs: ["OF_306", "I_9", "DIRECT_DEPOSIT", "SF_86"],
    backgroundReferenceTypes: ["supervisor", "coworker", "personal", "residence", "education"],
  },
};

function nowIso() {
  return new Date().toISOString();
}

function stableStringify(input: unknown): string {
  if (input === null || typeof input !== "object") return JSON.stringify(input);
  if (Array.isArray(input)) return `[${input.map(stableStringify).join(",")}]`;

  const entries = Object.entries(input as Record<string, unknown>).sort(([a], [b]) =>
    a.localeCompare(b),
  );
  return `{${entries
    .map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`)
    .join(",")}}`;
}

function cheapHash(value: string): string {
  let h = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `h_${(h >>> 0).toString(16)}`;
}

function makeIdempotencyKey(
  scopeId: string,
  type: IdempotentAction["type"],
  target: string,
  payload: Record<string, unknown>,
) {
  return cheapHash(`${scopeId}|${type}|${target}|${stableStringify(payload)}`);
}

function queueAction(
  context: FedOnboardContext,
  type: IdempotentAction["type"],
  target: string,
  payload: Record<string, unknown>,
  requiresHumanApproval: boolean,
): IdempotentAction {
  const idempotencyKey = makeIdempotencyKey(context.scope.scopeId, type, target, payload);
  const existing = context.queuedActions.find((a) => a.idempotencyKey === idempotencyKey);
  if (existing) return existing;

  return {
    actionId: `act_${idempotencyKey}`,
    idempotencyKey,
    type,
    status: requiresHumanApproval ? "AwaitingHumanApproval" : "Queued",
    input: payload,
    requiresHumanApproval,
    createdAt: nowIso(),
  };
}

function referenceMockQuestions(
  type: InvestigationReference["referenceType"],
): string[] {
  switch (type) {
    case "supervisor":
      return [
        "Please confirm employment dates and role responsibilities.",
        "Did you observe any conduct concerns relevant to reliability or trust?",
      ];
    case "coworker":
      return [
        "How long have you known the candidate in a professional context?",
        "Can you describe collaboration and integrity in team settings?",
      ];
    case "personal":
      return [
        "How long have you known the candidate personally?",
        "Any concerns regarding reliability, judgment, or legal obligations?",
      ];
    case "residence":
      return [
        "Can you confirm residential occupancy timeframe?",
        "Any known tenancy/legal disputes relevant to record verification?",
      ];
    case "education":
      return [
        "Can you validate enrollment/completion details?",
        "Any discrepancy between records and stated credentials?",
      ];
    default:
      return ["Please provide available verification details."];
  }
}

function buildRoleSyncView(context: FedOnboardContext, role: Role): RoleSyncView {
  const base = {
    role,
    writtenAt: nowIso(),
  };

  if (role === "candidate") {
    const visibleDocs = Object.values(context.documents).filter((d) =>
      ["public_process", "candidate_private"].includes(d.exposureClass),
    );

    return {
      ...base,
      syncViewId: `candidate:${context.scope.scopeId}`,
      visibleFields: {
        scopeId: context.scope.scopeId,
        state: context.scope.currentState,
        phase: context.scope.currentPhase,
        requiredDocs: context.clearanceConfig.requiredDocs,
        documents: visibleDocs,
        pendingTasks: Object.values(context.tasks).filter((t) => t.owner === "candidate"),
      },
      redactedFields: ["riskFlags", "security_notes", "compensation_internal_notes"],
      allowedActions: ["upload_document", "confirm_task", "request_help"],
      projectionHash: cheapHash(
        stableStringify({
          state: context.scope.currentState,
          docs: visibleDocs.map((d) => [d.id, d.status]),
        }),
      ),
    };
  }

  if (role === "security") {
    const visibleDocs = Object.values(context.documents).filter((d) =>
      ["security_sensitive", "candidate_private", "public_process"].includes(
        d.exposureClass,
      ),
    );

    return {
      ...base,
      syncViewId: `security:${context.scope.scopeId}`,
      visibleFields: {
        candidateDisplayName: context.candidate.displayName,
        clearancePath: context.scope.clearancePath,
        suitabilityForm: context.clearanceConfig.suitabilityForm,
        references: Object.values(context.references),
        documents: visibleDocs,
      },
      redactedFields: ["compensation", "payNegotiation", "adminAuditInternals"],
      allowedActions: [
        "request_more_info",
        "mark_interim",
        "mark_fully_cleared",
        "request_document",
      ],
      projectionHash: cheapHash(
        stableStringify({
          form: context.clearanceConfig.suitabilityForm,
          refs: Object.values(context.references).map((r) => [r.referenceId, r.status]),
        }),
      ),
    };
  }

  return {
    ...base,
    syncViewId: `${role}:${context.scope.scopeId}`,
    visibleFields: {
      scopeId: context.scope.scopeId,
      state: context.scope.currentState,
      phase: context.scope.currentPhase,
    },
    redactedFields: ["candidate_private", "security_sensitive", "hr_confidential"],
    allowedActions: [],
    projectionHash: cheapHash(
      stableStringify({ state: context.scope.currentState, phase: context.scope.currentPhase }),
    ),
  };
}

const createDefaultContext = (): FedOnboardContext => ({
  scope: {
    scopeId: "<SCOPE_ID>",
    agency: "<AGENCY_NAME>",
    roleTitle: "<POSITION_TITLE>",
    payPlan: "GS",
    grade: "<GRADE>",
    dutyStation: "<DUTY_STATION>",
    sensitivityLevel: "<SENSITIVITY_LEVEL>",
    clearancePath: "PUBLIC_TRUST_MODERATE",
    currentState: "draft",
    currentPhase: "pre_tjo",
    createdAt: nowIso(),
    updatedAt: nowIso(),
  },
  candidate: {
    candidateId: "<CANDIDATE_ID>",
    displayName: "<DISPLAY_NAME>",
    email: "<EMAIL>",
  },
  clearanceConfig: CLEARANCE_PATH_CONFIG.PUBLIC_TRUST_MODERATE,
  documents: {},
  tasks: {},
  references: {},
  queuedActions: [],
  receipts: [],
  riskFlags: [],
});

export const fedOnboardMachine = setup({
  types: {
    context: {} as FedOnboardContext,
    events: {} as FedOnboardEvent,
  },

  guards: {
    requiresFingerprinting: ({ context }) => context.clearanceConfig.requiresFingerprinting,
    requiresQuestionnaire: ({ context }) =>
      context.clearanceConfig.requiresNationalSecurityQuestionnaire ||
      !!context.clearanceConfig.suitabilityForm,
    requiresInterimReview: ({ context }) => context.clearanceConfig.requiresInterimReview,
    requiresDisclosure: ({ context }) => !!context.postStart?.disclosureRequired,
  },

  actions: {
    loadScopeInput: assign(({ context, event }) => {
      if (event.type !== "INIT_SCOPE") return context;
      return {
        ...context,
        ...event.input,
      };
    }),

    configureClearancePath: assign(({ context, event }) => {
      if (event.type !== "CLASSIFICATION_CONFIRMED") return context;
      const cfg = CLEARANCE_PATH_CONFIG[event.clearancePath];
      return {
        ...context,
        scope: {
          ...context.scope,
          clearancePath: event.clearancePath,
          updatedAt: nowIso(),
        },
        clearanceConfig: cfg,
      };
    }),

    requestPathDocuments: assign(({ context }) => {
      const nextDocs = { ...context.documents };

      for (const docType of context.clearanceConfig.requiredDocs) {
        const id = `doc_${docType.toLowerCase()}`;
        if (!nextDocs[id]) {
          nextDocs[id] = {
            id,
            type: docType,
            status: "requested",
            exposureClass:
              docType === "SF_86" || docType === "SF_85P"
                ? "security_sensitive"
                : "candidate_private",
            requestedAt: nowIso(),
          };
        }
      }

      const act = queueAction(
        context,
        "REQUEST_DOCUMENT",
        "candidate",
        { requiredDocs: context.clearanceConfig.requiredDocs },
        false,
      );

      return {
        ...context,
        documents: nextDocs,
        queuedActions: [...context.queuedActions, act],
      };
    }),

    createFingerprintTask: assign(({ context }) => {
      const taskId = "task_fingerprint_schedule";
      if (context.tasks[taskId]) return context;

      const task: Task = {
        taskId,
        title: "Schedule and complete fingerprint enrollment",
        owner: "candidate",
        status: "pending",
        blocksProgress: true,
      };

      return {
        ...context,
        tasks: { ...context.tasks, [taskId]: task },
      };
    }),

    createQuestionnaireTask: assign(({ context }) => {
      const form = context.clearanceConfig.suitabilityForm;
      const taskId = `task_questionnaire_${form.toLowerCase()}`;
      if (context.tasks[taskId]) return context;

      return {
        ...context,
        tasks: {
          ...context.tasks,
          [taskId]: {
            taskId,
            title: `Complete ${form} questionnaire in NBIS/eApp`,
            owner: "candidate",
            status: "pending",
            blocksProgress: true,
          },
        },
      };
    }),

    createReferenceCallouts: assign(({ context }) => {
      const next = { ...context.references };
      for (const referenceType of context.clearanceConfig.backgroundReferenceTypes) {
        const id = `ref_${referenceType}`;
        if (next[id]) continue;
        next[id] = {
          referenceId: id,
          referenceType,
          name: `<${referenceType.toUpperCase()}_CONTACT>`,
          status: "pending",
          mockQuestionSet: referenceMockQuestions(referenceType),
        };
      }

      const act = queueAction(
        context,
        "REQUEST_REFERENCE_CALL",
        "security",
        { referenceTypes: context.clearanceConfig.backgroundReferenceTypes },
        true,
      );

      return {
        ...context,
        references: next,
        queuedActions: [...context.queuedActions, act],
      };
    }),

    queueHumanApprovalEmail: assign(({ context }) => {
      const action = queueAction(
        context,
        "SEND_EMAIL",
        "office_poc",
        {
          template: "visitor_clearance_request",
          subject: "<VISITOR_CLEARANCE_SUBJECT>",
        },
        true,
      );

      return {
        ...context,
        queuedActions: [...context.queuedActions, action],
      };
    }),

    approveAction: assign(({ context, event }) => {
      if (event.type !== "HUMAN_APPROVED_ACTION") return context;
      return {
        ...context,
        queuedActions: context.queuedActions.map((a) =>
          a.actionId === event.actionId ? { ...a, status: "Approved" } : a,
        ),
      };
    }),

    rejectAction: assign(({ context, event }) => {
      if (event.type !== "HUMAN_REJECTED_ACTION") return context;
      return {
        ...context,
        queuedActions: context.queuedActions.map((a) =>
          a.actionId === event.actionId ? { ...a, status: "Rejected" } : a,
        ),
        lastError: event.reason,
      };
    }),

    executedAction: assign(({ context, event }) => {
      if (event.type !== "ACTION_EXECUTED") return context;
      return {
        ...context,
        queuedActions: context.queuedActions.map((a) =>
          a.actionId === event.actionId ? { ...a, status: "Executed" } : a,
        ),
      };
    }),

    writeUnifiedSyncViews: assign(({ context }) => {
      const roles: Role[] = ["candidate", "hr", "security", "it", "office_poc", "admin"];
      const payload = roles.map((r) => buildRoleSyncView(context, r));

      const action = queueAction(
        context,
        "WRITE_SYNC_VIEW",
        "unified_sync",
        { count: payload.length },
        false,
      );

      return {
        ...context,
        queuedActions: [...context.queuedActions, action],
      };
    }),

    updateStateMeta:
      assign(({ context, self }) => ({
        ...context,
        scope: {
          ...context.scope,
          currentState: String(self.getSnapshot()?.value ?? context.scope.currentState),
          updatedAt: nowIso(),
        },
      })),

    setInterimApprovedPhase: assign(({ context }) => ({
      ...context,
      scope: { ...context.scope, currentPhase: "interim_approved", updatedAt: nowIso() },
    })),

    setFinalOfferReceived: assign(({ context, event }) => {
      if (event.type !== "FINAL_OFFER_RECEIVED") return context;
      return {
        ...context,
        finalOffer: { ...(context.finalOffer ?? {}), receivedAt: event.at },
      };
    }),

    setFinalOfferAccepted: assign(({ context, event }) => {
      if (event.type !== "FINAL_OFFER_ACCEPTED") return context;
      return {
        ...context,
        finalOffer: {
          ...(context.finalOffer ?? {}),
          acceptedAt: event.at,
          eodDate: event.eodDate,
        },
      };
    }),

    markPostStart: assign(({ context, event }) => {
      const post = { ...(context.postStart ?? {}) };

      if (event.type === "P4P_RECEIVED") post.p4pStarted = true;
      if (event.type === "PIV_READY") post.pivReady = true;
      if (event.type === "PIV_PICKED_UP") post.pivPickedUp = true;
      if (event.type === "EQUIPMENT_RECEIVED") post.equipmentReceived = true;
      if (event.type === "ORIENTATION_DONE") post.orientationDone = true;
      if (event.type === "ETHICS_DONE") post.ethicsCompleted = true;
      if (event.type === "DISCLOSURE_REQUIRED") post.disclosureRequired = true;
      if (event.type === "DISCLOSURE_SUBMITTED") post.disclosureSubmitted = true;

      return { ...context, postStart: post };
    }),
  },
}).createMachine({
  id: "fedOnboardMain",
  context: createDefaultContext(),
  initial: "scopeDraft",

  states: {
    scopeDraft: {
      entry: ["updateStateMeta", "writeUnifiedSyncViews"],
      on: {
        INIT_SCOPE: { actions: "loadScopeInput" },
        TJO_ACCEPTED: "classification",
      },
    },

    classification: {
      entry: ["updateStateMeta"],
      on: {
        CLASSIFICATION_CONFIRMED: {
          target: "documentRequest",
          actions: ["configureClearancePath"],
        },
      },
    },

    documentRequest: {
      entry: ["requestPathDocuments", "writeUnifiedSyncViews", "updateStateMeta"],
      always: [
        { target: "fingerprintEnrollment", guard: "requiresFingerprinting" },
        { target: "questionnairePending" },
      ],
    },

    fingerprintEnrollment: {
      entry: ["createFingerprintTask", "updateStateMeta", "writeUnifiedSyncViews"],
      on: {
        ENROLLMENT_EMAIL_RECEIVED: "fingerprintScheduled",
      },
    },

    fingerprintScheduled: {
      entry: ["updateStateMeta", "queueHumanApprovalEmail", "writeUnifiedSyncViews"],
      on: {
        HUMAN_APPROVED_ACTION: { actions: "approveAction" },
        HUMAN_REJECTED_ACTION: { actions: "rejectAction" },
        FINGERPRINT_APPOINTMENT_SET: "fingerprintsComplete",
      },
    },

    fingerprintsComplete: {
      entry: ["updateStateMeta", "writeUnifiedSyncViews"],
      on: {
        FINGERPRINTS_COMPLETED: "questionnairePending",
      },
    },

    questionnairePending: {
      entry: ["createQuestionnaireTask", "updateStateMeta", "writeUnifiedSyncViews"],
      on: {
        QUESTIONNAIRE_LINK_RECEIVED: "questionnaireInProgress",
      },
    },

    questionnaireInProgress: {
      entry: ["updateStateMeta"],
      on: {
        QUESTIONNAIRE_SUBMITTED: "referencesWorkflow",
      },
    },

    referencesWorkflow: {
      entry: ["createReferenceCallouts", "writeUnifiedSyncViews", "updateStateMeta"],
      on: {
        REFERENCE_REQUESTS_CREATED: "referencesPending",
      },
    },

    referencesPending: {
      on: {
        REFERENCE_RESPONSES_LOGGED: [
          { target: "interimReview", guard: "requiresInterimReview" },
          { target: "fullClearance" },
        ],
      },
    },

    interimReview: {
      entry: ["updateStateMeta", "setInterimApprovedPhase", "writeUnifiedSyncViews"],
      on: {
        INTERIM_GRANTED: "fullClearance",
        FULLY_CLEARED: "finalOfferPending",
      },
    },

    fullClearance: {
      entry: ["updateStateMeta", "writeUnifiedSyncViews"],
      on: {
        FULLY_CLEARED: "finalOfferPending",
      },
    },

    finalOfferPending: {
      entry: ["updateStateMeta"],
      on: {
        FINAL_OFFER_RECEIVED: {
          target: "finalOfferReview",
          actions: "setFinalOfferReceived",
        },
      },
    },

    finalOfferReview: {
      entry: ["updateStateMeta", "writeUnifiedSyncViews"],
      on: {
        FINAL_OFFER_ACCEPTED: {
          target: "eodConfirmed",
          actions: "setFinalOfferAccepted",
        },
      },
    },

    eodConfirmed: {
      entry: ["updateStateMeta", "writeUnifiedSyncViews"],
      on: {
        P4P_RECEIVED: { target: "provisioning", actions: "markPostStart" },
      },
    },

    provisioning: {
      entry: ["updateStateMeta", "writeUnifiedSyncViews"],
      on: {
        PIV_READY: { target: "pivFlow", actions: "markPostStart" },
      },
    },

    pivFlow: {
      entry: ["updateStateMeta"],
      on: {
        PIV_PICKED_UP: { target: "equipment", actions: "markPostStart" },
      },
    },

    equipment: {
      entry: ["updateStateMeta", "writeUnifiedSyncViews"],
      on: {
        EQUIPMENT_RECEIVED: { target: "orientation", actions: "markPostStart" },
      },
    },

    orientation: {
      entry: ["updateStateMeta"],
      on: {
        ORIENTATION_DONE: { target: "ethics", actions: "markPostStart" },
      },
    },

    ethics: {
      entry: ["updateStateMeta", "writeUnifiedSyncViews"],
      on: {
        ETHICS_DONE: { target: "disclosureCheck", actions: "markPostStart" },
      },
    },

    disclosureCheck: {
      entry: ["updateStateMeta"],
      on: {
        DISCLOSURE_REQUIRED: { target: "disclosurePending", actions: "markPostStart" },
      },
      always: [{ target: "complete", guard: ({ context }) => !context.postStart?.disclosureRequired }],
    },

    disclosurePending: {
      on: {
        DISCLOSURE_SUBMITTED: { target: "complete", actions: "markPostStart" },
      },
    },

    complete: {
      type: "final",
      entry: ["updateStateMeta", "writeUnifiedSyncViews"],
    },
  },
});

export default fedOnboardMachine;
