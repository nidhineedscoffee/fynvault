import { createSupabaseServerClient } from "./supabase";

export const processingStages = [
  "collection",
  "classification",
  "extraction",
  "validation",
  "normalization",
  "memory_build",
  "intelligence_ready"
] as const;

export type ProcessingStageName = (typeof processingStages)[number];

export type ServiceResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; error: string };

function serviceUnavailable<T>(error = "Supabase is not configured."): ServiceResult<T> {
  return { ok: false, status: 503, error };
}

function badRequest<T>(error: string): ServiceResult<T> {
  return { ok: false, status: 400, error };
}

function notFound<T>(error: string): ServiceResult<T> {
  return { ok: false, status: 404, error };
}

function dbError<T>(error: { message: string }): ServiceResult<T> {
  return { ok: false, status: 500, error: error.message };
}

function clampScore(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round(value)));
}

function average(values: number[]) {
  const clean = values.filter((value) => Number.isFinite(value));
  if (clean.length === 0) {
    return 0;
  }

  return clean.reduce((sum, value) => sum + value, 0) / clean.length;
}

function uuidIsValid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function getProcessingOverview(clientId?: string, firmId?: string) {
  const supabase = createSupabaseServerClient();
  if (!supabase) {
    return serviceUnavailable<unknown>();
  }

  let query = supabase.from("processing_jobs").select("id,client_id,status,current_stage,intelligence_ready,intelligence_readiness_score,created_at,updated_at");
  if (clientId) {
    if (!uuidIsValid(clientId)) {
      return badRequest("clientId must be a valid UUID.");
    }
    query = query.eq("client_id", clientId);
  } else if (firmId) {
    if (!uuidIsValid(firmId)) {
      return badRequest("firmId must be a valid UUID.");
    }
    query = query.eq("firm_id", firmId);
  }

  const { data, error } = await query.order("created_at", { ascending: false }).limit(100);
  if (error) {
    return dbError(error);
  }

  const jobs = data ?? [];
  const counts = jobs.reduce(
    (acc, job) => {
      acc.total += 1;
      acc.byStatus[job.status] = (acc.byStatus[job.status] ?? 0) + 1;
      if (job.intelligence_ready) {
        acc.intelligenceReady += 1;
      }
      return acc;
    },
    { total: 0, intelligenceReady: 0, byStatus: {} as Record<string, number> }
  );

  return { ok: true as const, data: { counts, jobs } };
}

export async function listProcessingJobs(clientId?: string, firmId?: string) {
  return getProcessingOverview(clientId, firmId);
}

export async function getProcessingJob(jobId: string) {
  if (!uuidIsValid(jobId)) {
    return badRequest("jobId must be a valid UUID.");
  }

  const supabase = createSupabaseServerClient();
  if (!supabase) {
    return serviceUnavailable<unknown>();
  }

  const [jobResult, stagesResult, issuesResult, recordsResult, datasetsResult] = await Promise.all([
    supabase.from("processing_jobs").select("*").eq("id", jobId).maybeSingle(),
    supabase.from("processing_stages").select("*").eq("job_id", jobId).order("stage_order", { ascending: true }),
    supabase.from("validation_issues").select("*").eq("job_id", jobId).order("created_at", { ascending: false }),
    supabase.from("normalized_records").select("*").eq("job_id", jobId).order("created_at", { ascending: false }),
    supabase.from("intelligence_datasets").select("*").eq("job_id", jobId).order("created_at", { ascending: false })
  ]);

  if (jobResult.error) {
    return dbError(jobResult.error);
  }
  if (!jobResult.data) {
    return notFound("Processing job not found.");
  }
  if (stagesResult.error) {
    return dbError(stagesResult.error);
  }
  if (issuesResult.error) {
    return dbError(issuesResult.error);
  }
  if (recordsResult.error) {
    return dbError(recordsResult.error);
  }
  if (datasetsResult.error) {
    return dbError(datasetsResult.error);
  }

  const readiness = await getIntelligenceReadiness(jobResult.data.client_id);

  return {
    ok: true as const,
    data: {
      job: jobResult.data,
      stages: stagesResult.data ?? [],
      validationIssues: issuesResult.data ?? [],
      normalizedRecords: recordsResult.data ?? [],
      intelligenceDatasets: datasetsResult.data ?? [],
      readiness: readiness.ok ? readiness.data : null
    }
  };
}

export async function retryProcessingJob(jobId: string) {
  if (!uuidIsValid(jobId)) {
    return badRequest("jobId must be a valid UUID.");
  }

  const supabase = createSupabaseServerClient();
  if (!supabase) {
    return serviceUnavailable<unknown>();
  }

  const { data: job, error: jobError } = await supabase.from("processing_jobs").select("id").eq("id", jobId).maybeSingle();
  if (jobError) {
    return dbError(jobError);
  }
  if (!job) {
    return notFound("Processing job not found.");
  }

  const [jobUpdate, stageUpdate] = await Promise.all([
    supabase
      .from("processing_jobs")
      .update({
        status: "queued",
        current_stage: "collection",
        intelligence_ready: false,
        updated_at: new Date().toISOString()
      })
      .eq("id", jobId)
      .select("*")
      .single(),
    supabase
      .from("processing_stages")
      .update({ status: "pending", started_at: null, completed_at: null })
      .eq("job_id", jobId)
  ]);

  if (jobUpdate.error) {
    return dbError(jobUpdate.error);
  }
  if (stageUpdate.error) {
    return dbError(stageUpdate.error);
  }

  return { ok: true as const, data: { job: jobUpdate.data } };
}

export async function listValidationIssues(clientId?: string, firmId?: string) {
  const supabase = createSupabaseServerClient();
  if (!supabase) {
    return serviceUnavailable<unknown>();
  }

  let query = supabase.from("validation_issues").select("*").order("created_at", { ascending: false }).limit(200);
  if (clientId) {
    if (!uuidIsValid(clientId)) {
      return badRequest("clientId must be a valid UUID.");
    }
    query = query.eq("client_id", clientId);
  } else if (firmId) {
    if (!uuidIsValid(firmId)) {
      return badRequest("firmId must be a valid UUID.");
    }
    query = query.eq("firm_id", firmId);
  }

  const { data, error } = await query;
  if (error) {
    return dbError(error);
  }

  return { ok: true as const, data: { issues: data ?? [] } };
}

export async function getClientProcessing(clientId: string) {
  if (!uuidIsValid(clientId)) {
    return badRequest("clientId must be a valid UUID.");
  }

  const supabase = createSupabaseServerClient();
  if (!supabase) {
    return serviceUnavailable<unknown>();
  }

  const [clientResult, jobsResult, issuesResult, sourcesResult] = await Promise.all([
    supabase.from("clients").select("*").eq("id", clientId).maybeSingle(),
    supabase.from("processing_jobs").select("*").eq("client_id", clientId).order("created_at", { ascending: false }),
    supabase.from("validation_issues").select("*").eq("client_id", clientId).order("created_at", { ascending: false }).limit(50),
    supabase.from("data_sources").select("*").eq("client_id", clientId).order("created_at", { ascending: false })
  ]);

  if (clientResult.error) {
    return dbError(clientResult.error);
  }
  if (!clientResult.data) {
    return notFound("Client not found.");
  }
  if (jobsResult.error) {
    return dbError(jobsResult.error);
  }
  if (issuesResult.error) {
    return dbError(issuesResult.error);
  }
  if (sourcesResult.error) {
    return dbError(sourcesResult.error);
  }

  const readiness = await getIntelligenceReadiness(clientId);

  return {
    ok: true as const,
    data: {
      client: clientResult.data,
      jobs: jobsResult.data ?? [],
      issues: issuesResult.data ?? [],
      dataSources: sourcesResult.data ?? [],
      readiness: readiness.ok ? readiness.data : null
    }
  };
}

export async function getIntelligenceReadiness(clientId: string) {
  if (!uuidIsValid(clientId)) {
    return badRequest("clientId must be a valid UUID.");
  }

  const supabase = createSupabaseServerClient();
  if (!supabase) {
    return serviceUnavailable<unknown>();
  }

  const [jobsResult, issuesResult, recordsResult, entitiesResult, datasetsResult, sourcesResult] = await Promise.all([
    supabase.from("processing_jobs").select("*").eq("client_id", clientId),
    supabase.from("validation_issues").select("*").eq("client_id", clientId),
    supabase.from("normalized_records").select("*").eq("client_id", clientId),
    supabase.from("memory_entities").select("*").eq("client_id", clientId),
    supabase.from("intelligence_datasets").select("*").eq("client_id", clientId),
    supabase.from("data_sources").select("*").eq("client_id", clientId)
  ]);

  for (const result of [jobsResult, issuesResult, recordsResult, entitiesResult, datasetsResult, sourcesResult]) {
    if (result.error) {
      return dbError(result.error);
    }
  }

  const jobs = jobsResult.data ?? [];
  const jobIds = jobs.map((job) => job.id);
  const stagesResult =
    jobIds.length > 0
      ? await supabase.from("processing_stages").select("status,stage_name,job_id").in("job_id", jobIds)
      : { data: [], error: null };

  if (stagesResult.error) {
    return dbError(stagesResult.error);
  }

  const stages = stagesResult.data ?? [];
  const issues = issuesResult.data ?? [];
  const records = recordsResult.data ?? [];
  const entities = entitiesResult.data ?? [];
  const datasets = datasetsResult.data ?? [];
  const sources = sourcesResult.data ?? [];

  const completedStages = stages.filter((stage) => stage.status === "completed").length;
  const dataCompleteness = clampScore(
    average([
      jobs.length > 0 ? 100 : 0,
      stages.length > 0 ? (completedStages / stages.length) * 100 : 0,
      records.length > 0 ? 100 : 0,
      entities.length > 0 ? 100 : 0,
      datasets.length > 0 ? 100 : 0
    ])
  );

  const openCritical = issues.filter((issue) => issue.status === "open" && issue.severity === "critical").length;
  const openIssues = issues.filter((issue) => issue.status === "open").length;
  const validationStatus = clampScore(openCritical > 0 ? 0 : Math.max(0, 100 - openIssues * 12));

  const reconciled = records.filter((record) => ["matched", "not_required"].includes(record.reconciliation_status)).length;
  const reconciliationStatus = clampScore(records.length > 0 ? (reconciled / records.length) * 100 : 0);

  const missingInputIssues = issues.filter((issue) => issue.status === "open" && issue.category === "missing_input").length;
  const connectedSources = sources.filter((source) => ["connected", "syncing"].includes(source.connection_status)).length;
  const missingInputs = clampScore(Math.max(0, 100 - missingInputIssues * 20 - (connectedSources === 0 ? 30 : 0)));

  const processingConfidence = clampScore(
    average([
      average(jobs.map((job) => Number(job.processing_confidence ?? 0))),
      average(records.map((record) => Number(record.confidence ?? 0))),
      average(entities.map((entity) => Number(entity.confidence ?? 0))),
      average(datasets.map((dataset) => Number(dataset.readiness_score ?? 0)))
    ])
  );

  const score = clampScore(
    dataCompleteness * 0.25 +
      validationStatus * 0.25 +
      reconciliationStatus * 0.2 +
      missingInputs * 0.15 +
      processingConfidence * 0.15
  );
  const intelligenceReady =
    score >= 80 &&
    jobs.length > 0 &&
    records.length > 0 &&
    entities.length > 0 &&
    datasets.length > 0 &&
    openCritical === 0;

  return {
    ok: true as const,
    data: {
      clientId,
      intelligenceReady,
      score,
      factors: {
        dataCompleteness,
        validationStatus,
        reconciliationStatus,
        missingInputs,
        processingConfidence
      },
      blockers: {
        openCritical,
        openIssues,
        missingInputIssues,
        connectedSources,
        jobs: jobs.length,
        normalizedRecords: records.length,
        memoryEntities: entities.length,
        intelligenceDatasets: datasets.length
      }
    }
  };
}

export async function requireIntelligenceReady(clientId: string) {
  const readiness = await getIntelligenceReadiness(clientId);
  if (!readiness.ok) {
    return readiness;
  }

  const data = readiness.data as {
    intelligenceReady: boolean;
    score: number;
    factors: Record<string, number>;
    blockers: Record<string, number>;
  };

  if (!data.intelligenceReady) {
    return {
      ok: false as const,
      status: 428,
      error: "Intelligence Ready status is false. Complete processing before using the Intelligence Engine.",
      readiness: data
    };
  }

  return { ok: true as const, data };
}
