// Supabase Edge Function stub: generate AI report.
// TODO: load patient profile and results, call ai-report package/LLM, save ai_reports.

Deno.serve(async (req) => {
  const body = await req.json().catch(() => ({}));
  return Response.json({
    ok: true,
    function: 'generate-report',
    todo: 'Call AI report generator with guardrails',
    input: body,
  });
});
