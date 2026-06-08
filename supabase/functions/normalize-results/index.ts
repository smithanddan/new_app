// Supabase Edge Function stub: normalize parsed lab items.
// TODO: match analyte_aliases, parse values/refs, insert lab_results.

Deno.serve(async (req) => {
  const body = await req.json().catch(() => ({}));
  return Response.json({
    ok: true,
    function: 'normalize-results',
    todo: 'Call biomarker-engine and save rows',
    input: body,
  });
});
