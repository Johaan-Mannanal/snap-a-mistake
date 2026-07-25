import { AnalyzeResponseSchema, FollowUpSchema, type MisconceptionTag } from '@snap/shared'
import { z } from 'zod'

export const ScanOriginSchema = z.enum(['camera', 'library'])
export type ScanOrigin = z.infer<typeof ScanOriginSchema>

export const AttemptKindSchema = z.enum(['original', 'follow-up'])
export type AttemptKind = z.infer<typeof AttemptKindSchema>

export const ScanLifecycleSchema = z.enum(['review', 'analyzing', 'complete', 'interrupted', 'unsaved'])
export type ScanLifecycle = z.infer<typeof ScanLifecycleSchema>

export const FeedbackStateSchema = z.enum(['unreviewed', 'accepted', 'corrected', 'rejected', 'excluded'])
export type FeedbackState = z.infer<typeof FeedbackStateSchema>

export const FollowUpStatusSchema = z.enum(['none', 'ready', 'in-progress', 'resolved', 'unresolved'])
export type FollowUpStatus = z.infer<typeof FollowUpStatusSchema>

export const RevisionReasonSchema = z.enum(['initial', 'retry', 'student-correction'])
export type RevisionReason = z.infer<typeof RevisionReasonSchema>

export const ScanRevisionSchema = z.object({
  id: z.string().min(1),
  reason: RevisionReasonSchema,
  response: AnalyzeResponseSchema,
  createdAt: z.string().datetime(),
})
export type ScanRevision = z.infer<typeof ScanRevisionSchema>

const ScanRecordFieldsSchema = z.object({
  id: z.string().min(1),
  imageUri: z.string().min(1),
  origin: ScanOriginSchema,
  attemptKind: AttemptKindSchema,
  parentScanId: z.string().min(1).nullable(),
  lifecycle: ScanLifecycleSchema,
  activeRevision: ScanRevisionSchema.nullable(),
  revisions: z.array(ScanRevisionSchema),
  feedback: FeedbackStateSchema,
  analysisDurationMs: z.number().int().nonnegative().nullable(),
  followUp: FollowUpSchema.nullable(),
  followUpStatus: FollowUpStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export const ScanRecordSchema = ScanRecordFieldsSchema.superRefine((scan, ctx) => {
  if (scan.attemptKind === 'follow-up' && scan.parentScanId === null)
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['parentScanId'], message: 'follow-up requires parentScanId' })
  if (scan.attemptKind === 'original' && scan.parentScanId !== null)
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['parentScanId'], message: 'original requires parentScanId to be null' })

  const activeRevision = scan.activeRevision
  if (activeRevision !== null) {
    const historyEntry = scan.revisions.find((revision) => revision.id === activeRevision.id)
    if (!historyEntry)
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['activeRevision'], message: 'activeRevision must be present in revisions' })
    else if (JSON.stringify(historyEntry) !== JSON.stringify(activeRevision))
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['activeRevision'], message: 'activeRevision must match its revision history entry' })
  }
  if (scan.activeRevision === null && scan.revisions.length > 0)
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['activeRevision'], message: 'revisions require an activeRevision' })
  if (scan.activeRevision !== null && scan.lifecycle === 'review')
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['lifecycle'], message: 'review scans cannot have an activeRevision' })
  if (scan.followUpStatus !== 'none' && scan.followUp === null)
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['followUpStatus'], message: 'followUpStatus requires followUp' })
  if (scan.followUpStatus === 'none' && scan.followUp !== null)
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['followUpStatus'], message: 'followUp requires a non-none followUpStatus' })
})
export type ScanRecord = z.infer<typeof ScanRecordSchema>

const PersistedSessionFieldsSchema = z.object({
  routeIntent: z.enum(['capture', 'review', 'analyze', 'result', 'follow-up']),
  pendingScanId: z.string().min(1).nullable(),
  photoUri: z.string().min(1).nullable(),
  origin: ScanOriginSchema.nullable(),
  analysis: AnalyzeResponseSchema.nullable(),
  followUp: FollowUpSchema.nullable(),
  parentScanId: z.string().min(1).nullable(),
})
export const PersistedSessionSchema = PersistedSessionFieldsSchema.superRefine((session, ctx) => {
  const hasScanData = session.pendingScanId !== null || session.photoUri !== null || session.origin !== null
    || session.analysis !== null || session.followUp !== null || session.parentScanId !== null
  if (session.routeIntent === 'capture' && hasScanData)
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'capture cannot retain scan data' })
  if (session.routeIntent === 'review' && (session.photoUri === null || session.origin === null))
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'review requires photoUri and origin' })
  if (session.routeIntent === 'analyze' && (session.pendingScanId === null || session.photoUri === null || session.origin === null))
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'analyze requires pendingScanId, photoUri, and origin' })
  if (session.routeIntent === 'result' && (session.pendingScanId === null || session.photoUri === null || session.origin === null || session.analysis === null))
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'result requires pendingScanId, photoUri, origin, and analysis' })
  if (session.routeIntent === 'follow-up' && (session.parentScanId === null || session.followUp === null))
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'follow-up requires parentScanId and followUp' })
})
export type PersistedSession = z.infer<typeof PersistedSessionSchema>

export type NewScanDraft = {
  id: string
  imageUri: string
  origin: ScanOrigin
  attemptKind: AttemptKind
  parentScanId: string | null
  createdAt: string
}

export type TrendSource =
  | { kind: 'scan'; scan: ScanRecord }
  | { kind: 'legacy'; tag: MisconceptionTag | null; correct: boolean; createdAt: string }
