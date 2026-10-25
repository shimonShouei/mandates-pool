export const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS site (
    id TEXT PRIMARY KEY,
    knesset_number INTEGER NOT NULL DEFAULT 26,
    prefer_computed_seats INTEGER NOT NULL DEFAULT 0,
    results_override INTEGER NOT NULL DEFAULT 0,
    last_fetch_attempt_at TEXT,
    last_fetch_error TEXT,
    board_revision INTEGER NOT NULL DEFAULT 0,
    threshold_bonus REAL NOT NULL DEFAULT 0.25,
    crowd_min_bets INTEGER NOT NULL DEFAULT 5,
    crowd_before_lock INTEGER NOT NULL DEFAULT 1
  )`,
  `CREATE TABLE IF NOT EXISTS groups (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE,
    deadline TEXT,
    election_start TEXT,
    public_board INTEGER NOT NULL DEFAULT 1,
    admin_token_hash TEXT,
    stake_agorot INTEGER NOT NULL DEFAULT 0,
    payout_split TEXT NOT NULL DEFAULT '100',
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS parties (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    ballot TEXT NOT NULL DEFAULT '',
    color TEXT NOT NULL,
    sort_order INTEGER NOT NULL,
    match_keys TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS participants (
    id TEXT PRIMARY KEY,
    group_id TEXT NOT NULL,
    display_name TEXT NOT NULL,
    name_key TEXT NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    paid INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    UNIQUE(group_id, name_key)
  )`,
  `CREATE TABLE IF NOT EXISTS predictions (
    participant_id TEXT NOT NULL,
    party_id TEXT NOT NULL,
    seats INTEGER NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (participant_id, party_id)
  )`,
  `CREATE TABLE IF NOT EXISTS surplus_agreements (
    id TEXT PRIMARY KEY,
    party_a_id TEXT NOT NULL,
    party_b_id TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS result_snapshots (
    id TEXT PRIMARY KEY,
    fetched_at TEXT NOT NULL,
    status TEXT NOT NULL,
    source TEXT NOT NULL,
    seat_method TEXT NOT NULL,
    source_url TEXT,
    counted_percent REAL,
    turnout_percent REAL,
    eligible_voters INTEGER,
    ballots_cast INTEGER,
    valid_votes INTEGER,
    invalid_votes INTEGER,
    is_current INTEGER NOT NULL DEFAULT 1,
    scoreable INTEGER NOT NULL DEFAULT 0,
    note TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS result_rows (
    id TEXT PRIMARY KEY,
    snapshot_id TEXT NOT NULL,
    party_id TEXT,
    source_name TEXT NOT NULL,
    source_ballot TEXT NOT NULL DEFAULT '',
    votes INTEGER,
    official_seats INTEGER,
    seats INTEGER NOT NULL,
    passed_threshold INTEGER NOT NULL,
    mapped INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS creation_log (
    id TEXT PRIMARY KEY,
    ip_hash TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS blocs (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    sort_order INTEGER NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS bloc_parties (
    bloc_id TEXT NOT NULL,
    party_id TEXT NOT NULL,
    PRIMARY KEY (bloc_id, party_id)
  )`,
  `CREATE TABLE IF NOT EXISTS board_cache (
    id TEXT PRIMARY KEY,
    cache_key TEXT NOT NULL,
    payload TEXT NOT NULL,
    computed_at TEXT NOT NULL,
    lock_until TEXT
  )`,
];

export const INDEX_STATEMENTS = [
  `CREATE INDEX IF NOT EXISTS idx_parties_sort ON parties(sort_order, name)`,
  `CREATE INDEX IF NOT EXISTS idx_participants_group ON participants(group_id)`,
  `CREATE INDEX IF NOT EXISTS idx_predictions_participant ON predictions(participant_id)`,
  `CREATE INDEX IF NOT EXISTS idx_groups_public ON groups(public_board, created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_rows_snapshot ON result_rows(snapshot_id)`,
  `CREATE INDEX IF NOT EXISTS idx_creation_log_ip ON creation_log(ip_hash, created_at)`,
];
