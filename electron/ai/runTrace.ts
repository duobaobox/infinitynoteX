import type {
  AIArtifact,
  AIRunStatus,
  AIRunTrace,
  AIStepKind,
  AIStepStatus,
  AIStepTrace,
} from '../../src/services/types';

type UpsertStepInput = {
  stepId: string;
  kind?: AIStepKind;
  title?: string;
  status: AIStepStatus;
  detail?: string;
  toolName?: string;
  approvalId?: string;
};

type AppendArtifactInput = Omit<AIArtifact, 'id' | 'createdAt'> & {
  id?: string;
  createdAt?: number;
};

function randomId(prefix: string): string {
  return `${prefix}_${Math.random().toString(16).slice(2, 10)}`;
}

function cloneRun(run: AIRunTrace): AIRunTrace {
  return JSON.parse(JSON.stringify(run)) as AIRunTrace;
}

function isTerminalStepStatus(status: AIStepStatus): boolean {
  return status === 'completed' || status === 'failed' || status === 'skipped';
}

function isTerminalRunStatus(status: AIRunStatus): boolean {
  return status === 'completed' || status === 'failed' || status === 'cancelled';
}

export class AIRunTracker {
  private run: AIRunTrace;

  constructor(args: { requestId: string; input: string; runId?: string }) {
    const now = Date.now();

    this.run = {
      runId: args.runId ?? randomId('run'),
      requestId: args.requestId,
      status: 'running',
      input: args.input,
      startedAt: now,
      steps: [],
      artifacts: [],
    };
  }

  get runId(): string {
    return this.run.runId;
  }

  snapshot(): AIRunTrace {
    return cloneRun(this.run);
  }

  setStatus(status: AIRunStatus, error?: string): AIRunTrace {
    this.run.status = status;

    if (error) {
      this.run.error = error;
    }

    if (isTerminalRunStatus(status)) {
      this.run.endedAt = Date.now();
    } else {
      this.run.endedAt = undefined;
    }

    return this.snapshot();
  }

  upsertStep(input: UpsertStepInput): AIStepTrace {
    const now = Date.now();
    const stepIndex = this.run.steps.findIndex((step) => step.stepId === input.stepId);

    if (stepIndex < 0) {
      const created: AIStepTrace = {
        stepId: input.stepId,
        kind: input.kind ?? 'planning',
        title: input.title ?? input.stepId,
        status: input.status,
        detail: input.detail,
        toolName: input.toolName,
        approvalId: input.approvalId,
        startedAt: now,
        ...(isTerminalStepStatus(input.status) ? { endedAt: now } : {}),
      };

      this.run.steps.push(created);
      return created;
    }

    const current = this.run.steps[stepIndex];
    const next: AIStepTrace = {
      ...current,
      ...(input.kind ? { kind: input.kind } : {}),
      ...(input.title ? { title: input.title } : {}),
      status: input.status,
      ...(input.detail !== undefined ? { detail: input.detail } : {}),
      ...(input.toolName !== undefined ? { toolName: input.toolName } : {}),
      ...(input.approvalId !== undefined ? { approvalId: input.approvalId } : {}),
    };

    if (isTerminalStepStatus(input.status)) {
      next.endedAt = now;
    } else {
      next.endedAt = undefined;
    }

    this.run.steps[stepIndex] = next;
    return next;
  }

  appendArtifact(artifact: AppendArtifactInput): AIArtifact {
    const nextArtifact: AIArtifact = {
      id: artifact.id ?? randomId('artifact'),
      type: artifact.type,
      title: artifact.title,
      summary: artifact.summary,
      data: artifact.data,
      createdAt: artifact.createdAt ?? Date.now(),
    };

    const existingIndex = this.run.artifacts.findIndex((item) => item.id === nextArtifact.id);
    if (existingIndex >= 0) {
      this.run.artifacts[existingIndex] = nextArtifact;
    } else {
      this.run.artifacts.push(nextArtifact);
    }

    return nextArtifact;
  }

  attachArtifactToStep(stepId: string, artifact: AIArtifact): void {
    const stepIndex = this.run.steps.findIndex((step) => step.stepId === stepId);
    if (stepIndex < 0) {
      return;
    }

    const target = this.run.steps[stepIndex];
    const existing = target.artifacts ?? [];
    const artifactIndex = existing.findIndex((item) => item.id === artifact.id);
    const nextArtifacts = [...existing];

    if (artifactIndex >= 0) {
      nextArtifacts[artifactIndex] = artifact;
    } else {
      nextArtifacts.push(artifact);
    }

    this.run.steps[stepIndex] = {
      ...target,
      artifacts: nextArtifacts,
    };
  }

  hasWaitingApprovals(): boolean {
    return this.run.steps.some((step) => step.kind === 'approval' && step.status === 'waiting');
  }
}
