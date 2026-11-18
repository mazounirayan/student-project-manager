export interface Deliverable {
  id: string
  title: string
  description: string
  projectId: string
  projectName: string
  type: "archive" | "git_link"
  dueDate: Date
  allowLateSubmission: boolean
  latePenalty: number
  maxFileSize?: number
  validationRules: ValidationRule[]
  createdAt: Date
  updatedAt: Date
}

export interface ValidationRule {
  id: string
  type: "file_presence" | "file_size" | "folder_structure" | "file_content"
  description: string
  parameters: Record<string, any>
  required: boolean
}

export interface Submission {
  id: string
  deliverableId: string
  groupId: string
  groupName: string
  submittedAt: Date
  submittedBy: string
  submitterName: string
  type: "archive" | "git_link"
  fileUrl?: string
  gitUrl?: string
  fileName?: string
  fileSize?: number
  status: "pending" | "validated" | "rejected" | "graded"
  validationResults: ValidationResult[]
  similarityScore?: number
  grade?: number
  feedback?: string
  isLate: boolean
  penaltyApplied?: number
}

export interface ValidationResult {
  ruleId: string
  ruleName: string
  status: "passed" | "failed" | "warning"
  message: string
  details?: string
}

export interface SimilarityAnalysis {
  submissionId: string
  comparisons: SimilarityComparison[]
  overallScore: number
  flagged: boolean
}

export interface SimilarityComparison {
  otherSubmissionId: string
  otherGroupName: string
  similarityScore: number
  matchedSections: string[]
}
