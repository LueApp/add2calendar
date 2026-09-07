import { calendarURL, makeICS } from './calendar.mjs';

export function basicAuth(username, password) {
  if (!username || username.includes(':') || !password) throw new Error('Enter your Nextcloud username and app password.');
  const bytes = new TextEncoder().encode(`${username}:${password}`);
  return 'Basic ' + btoa(Array.from(bytes, b => String.fromCharCode(b)).join(''));
}

export async function addToNextcloud(config, event, sessions, reminder, fetcher = fetch) {
  const base = calendarURL(config.calendarUrl);
  const authorization = basicAuth(config.username, config.appPassword);
  const result = { added: 0, existing: 0, failed: 0, errors: [] };
  for (let index = 0; index < sessions.length; index++) {
    const session = sessions[index];
    try {
      const response = await fetcher(new URL(encodeURIComponent(session.uid) + '.ics', base).href, {
        method: 'PUT', credentials: 'omit', redirect: 'error', cache: 'no-store',
        signal: AbortSignal.timeout(20000),
        headers: { Authorization: authorization, 'Content-Type': 'text/calendar; charset=utf-8', 'If-None-Match': '*' },
        body: makeICS(event, [session], reminder)
      });
      if (response.status === 412) result.existing++;
      else if ([201, 204].includes(response.status)) result.added++;
      else if ([401, 403].includes(response.status)) {
        result.stop = true;
        result.failed += sessions.length - index;
        result.errors.push(response.status === 401 ? 'Nextcloud rejected the username or app password. Check Settings.' : 'This account cannot write to the selected calendar. Check Settings.');
        break;
      } else throw new Error(`Nextcloud returned HTTP ${response.status}. Check the calendar URL and try again.`);
    } catch (error) {
      result.failed++;
      result.errors.push(error instanceof TypeError || error.name === 'TimeoutError' ? 'Could not reach Nextcloud. Check the connection, server permission, and calendar URL.' : error.message);
    }
  }
  result.errors = [...new Set(result.errors)];
  return result;
}
