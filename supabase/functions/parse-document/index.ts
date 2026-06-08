// Supabase Edge Function stub: parse uploaded document.
// TODO: fetch private file with service role, call MarkItDown worker or OCR fallback,
// then update lab_documents.raw_text / parsed_json / status.

Deno.serve(async (req) => {
  const body = await req.json().catch(() => ({}));
  return Response.json({
    ok: true,
    function: 'parse-document',
    todo: 'Call document-parser package/worker',
    input: body,
  });
});
