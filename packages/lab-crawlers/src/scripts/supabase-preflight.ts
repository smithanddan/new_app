import { lookup } from 'node:dns/promises';

const timeoutMs = Number(process.env.SUPABASE_PREFLIGHT_TIMEOUT_MS ?? 10_000);

async function main(): Promise<void> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
  }

  const baseUrl = parseSupabaseUrl(supabaseUrl);
  const safeTarget = `${baseUrl.protocol}//${baseUrl.hostname}`;

  console.log(`Supabase preflight: checking ${safeTarget}`);

  await checkDns(baseUrl.hostname);
  await checkRestApi(baseUrl, serviceRoleKey);

  console.log('Supabase preflight: ok');
}

function parseSupabaseUrl(value: string): URL {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'https:') {
      throw new Error(`expected https URL, got ${parsed.protocol}`);
    }
    return parsed;
  } catch (error) {
    throw new Error(`SUPABASE_URL is invalid: ${formatError(error)}`);
  }
}

async function checkDns(hostname: string): Promise<void> {
  try {
    const result = await lookup(hostname);
    console.log(`Supabase preflight: DNS ok (${hostname} -> ${result.address})`);
  } catch (error) {
    throw new Error(`Supabase DNS lookup failed for ${hostname}: ${formatError(error)}`);
  }
}

async function checkRestApi(baseUrl: URL, serviceRoleKey: string): Promise<void> {
  const endpoint = new URL('/rest/v1/lab_providers', baseUrl);
  endpoint.searchParams.set('select', 'id');
  endpoint.searchParams.set('limit', '1');

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        apikey: serviceRoleKey,
        authorization: `Bearer ${serviceRoleKey}`,
        accept: 'application/json',
      },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    throw new Error(`Supabase REST fetch failed: ${formatError(error)}`);
  }

  if (!response.ok) {
    const body = await safeResponseText(response);
    throw new Error(
      `Supabase REST check failed: HTTP ${response.status} ${response.statusText}${body ? `; body=${body}` : ''}`,
    );
  }

  console.log(`Supabase preflight: REST ok (HTTP ${response.status})`);
}

async function safeResponseText(response: Response): Promise<string> {
  try {
    return sanitizeLogText(await response.text());
  } catch {
    return '';
  }
}

function sanitizeLogText(value: string): string {
  return value.replace(/\s+/g, ' ').slice(0, 300);
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    const cause = error.cause instanceof Error ? `; cause=${error.cause.message}` : '';
    const code = hasCode(error) ? `; code=${error.code}` : '';
    return `${error.name}: ${error.message}${code}${cause}`;
  }
  return String(error);
}

function hasCode(error: Error): error is Error & { code: string } {
  return 'code' in error && typeof (error as { code?: unknown }).code === 'string';
}

main().catch((error: unknown) => {
  console.error(formatError(error));
  process.exitCode = 1;
});
