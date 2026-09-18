// Requires Node.js 18+ for the native fetch API.

const LEAGUE_ID = 'YOUR_LEAGUE_ID';
const ESPN_S2 = 'YOUR_ESPN_S2_COOKIE';
const SWID = '{YOUR-SWID-COOKIE}';

// Kept as requested. The public espn.com page is not itself a JSON API route;
// replace this with the league-specific ESPN Fantasy API URL when running the script.
const API_URL = 'https://espn.com';

async function fetchLeagueData() {
  const response = await fetch(API_URL, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      // ESPN uses these cookies to authorize requests for private leagues.
      Cookie: `espn_s2=${ESPN_S2}; SWID=${SWID}`,
    },
  });

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error(
        `ESPN rejected the credentials (HTTP ${response.status}). Check LEAGUE_ID, ESPN_S2, and SWID.`,
      );
    }

    throw new Error(`ESPN request failed with HTTP ${response.status} ${response.statusText}`);
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    throw new Error(
      `Expected JSON from ${API_URL}, but received ${contentType || 'an unknown content type'}. ` +
        'Use the league-specific ESPN Fantasy API URL rather than the public ESPN homepage.',
    );
  }

  return response.json();
}

function printTeamsAndRosters(data) {
  // Fantasy API responses typically expose teams in data.teams. A team usually
  // has location, nickname, and roster.entries fields; inspect the raw response
  // if your selected view uses a different shape.
  const teams = data.teams ?? [];

  for (const team of teams) {
    const teamName = [team.location, team.nickname].filter(Boolean).join(' ') || team.name;
    console.log(`\n${teamName ?? 'Unnamed team'}`);

    // Each roster entry commonly contains playerPoolEntry.player.fullName.
    const roster = team.roster?.entries ?? [];
    for (const entry of roster) {
      const player = entry.playerPoolEntry?.player;
      console.log(`  - ${player?.fullName ?? 'Unknown player'}`);
    }
  }
}

async function main() {
  if (
    [LEAGUE_ID, ESPN_S2, SWID].some((value) => value.startsWith('YOUR_') || value.includes('YOUR-SWID'))
  ) {
    throw new Error('Replace the placeholder league ID and cookie values before running the script.');
  }

  const data = await fetchLeagueData();
  printTeamsAndRosters(data);
}

main().catch((error) => {
  console.error(`Unable to fetch ESPN Fantasy data: ${error.message}`);
  process.exitCode = 1;
});