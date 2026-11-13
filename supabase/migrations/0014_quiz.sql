-- Quiz Rush: every 20 minutes (quiz hours, Ulaanbaatar time) one blockchain question goes live
-- for everyone at once. People type the answer; the first 20 right answers score, faster = more.
-- Letters of the answer show up as the clock runs, Gartic-style. Points are paid as stars, and
-- the leaderboard ranks quiz points only. Rounds are made on demand by whoever looks first.

create extension if not exists fuzzystrmatch with schema extensions;

insert into ubbw.config (key, value) values
  ('quiz_on', 'true'),
  ('quiz_every_min', '20'),
  ('quiz_open_sec', '90'),
  ('quiz_hours', '10-22'),                -- rounds start from 10:00 until 21:40
  ('quiz_points', '50,40,30,20,20,20,20,20,20,20,10,10,10,10,10,10,10,10,10,10') -- one per spot
on conflict (key) do nothing;

create table if not exists ubbw.quiz_questions (
  id        serial primary key,
  question  text not null,
  answer    text not null,                  -- shown after the round, drawn as the blanks
  also      text[] not null default '{}',   -- other accepted answers
  used      integer not null default 0
);
create table if not exists ubbw.quiz_rounds (
  slot        bigint primary key,           -- floor(epoch / round length)
  question_id integer not null references ubbw.quiz_questions(id),
  opens_at    timestamptz not null,
  closes_at   timestamptz not null
);
create table if not exists ubbw.quiz_solves (
  slot     bigint not null references ubbw.quiz_rounds(slot) on delete cascade,
  user_id  uuid not null references ubbw.profiles(id) on delete cascade,
  rank     integer not null,
  points   integer not null,
  ms       integer not null,                -- time from the question opening
  at       timestamptz not null default now(),
  primary key (slot, user_id),
  unique (slot, rank)
);
create index if not exists quiz_solves_user on ubbw.quiz_solves (user_id);
create table if not exists ubbw.quiz_tries (
  slot     bigint not null references ubbw.quiz_rounds(slot) on delete cascade,
  user_id  uuid not null references ubbw.profiles(id) on delete cascade,
  tries    integer not null default 0,
  last_at  timestamptz not null default now(),
  primary key (slot, user_id)
);
do $$ declare t text; begin
  foreach t in array array['quiz_questions','quiz_rounds','quiz_solves','quiz_tries'] loop
    execute format('alter table ubbw.%I enable row level security', t);
  end loop;
end $$;

create or replace function ubbw.quiz_norm(t text) returns text
language sql immutable as $$ select left(regexp_replace(lower(coalesce(t, '')), '[^[:alnum:]]', '', 'g'), 100) $$;

create or replace function ubbw.quiz_len() returns integer
language sql stable as $$ select coalesce(ubbw.cfg('quiz_every_min'), '20')::int * 60 $$;

create or replace function ubbw.quiz_points() returns integer[]
language sql stable as $$ select string_to_array(coalesce(ubbw.cfg('quiz_points'), '50,40,30,20,20,20,20,20,20,20'), ',')::int[] $$;

-- Does this slot run a question? (switched on, and starts inside quiz hours)
create or replace function ubbw.quiz_slot_ok(s bigint) returns boolean
language sql stable as $$
  select coalesce(ubbw.cfg('quiz_on'), 'true') = 'true'
     and extract(hour from to_timestamp(s * ubbw.quiz_len()) at time zone 'Asia/Ulaanbaatar')::int
         between split_part(coalesce(ubbw.cfg('quiz_hours'), '10-22'), '-', 1)::int
             and split_part(coalesce(ubbw.cfg('quiz_hours'), '10-22'), '-', 2)::int - 1
$$;

-- The round for a slot, made the first time anyone asks while it can still be played.
-- Fresh questions first; once all are used they come round again.
create or replace function ubbw.quiz_round(s bigint) returns ubbw.quiz_rounds
language plpgsql as $$
declare r ubbw.quiz_rounds; q int; len int := ubbw.quiz_len();
        open_s int := least(coalesce(ubbw.cfg('quiz_open_sec'), '90')::int, len);
begin
  select * into r from ubbw.quiz_rounds where slot = s;
  if found then return r; end if;
  if not ubbw.quiz_slot_ok(s) or now() >= to_timestamp(s * len) + make_interval(secs => open_s) then return null; end if;
  select id into q from ubbw.quiz_questions order by used, random() limit 1;
  if q is null then return null; end if;
  insert into ubbw.quiz_rounds (slot, question_id, opens_at, closes_at)
  values (s, q, to_timestamp(s * len), to_timestamp(s * len) + make_interval(secs => open_s))
  on conflict (slot) do nothing returning * into r;
  if found then
    update ubbw.quiz_questions set used = used + 1 where id = q;
    return r;
  end if;
  select * into r from ubbw.quiz_rounds where slot = s; -- someone else made it a moment ago
  return r;
end $$;

-- The answer as blanks ("S_t_s__"), with one more letter showing per third of the clock.
-- Never more than a third of the letters, so short answers stay hidden.
create or replace function ubbw.quiz_hint(ans text, shown int, seed bigint) returns text
language plpgsql immutable as $$
declare chars text[] := regexp_split_to_array(ans, ''); idx int[]; pick int[]; res text := ''; i int;
begin
  select array_agg(g order by md5(seed::text || ':' || g)) into idx
    from generate_series(1, cardinality(chars)) g where chars[g] ~ '[[:alnum:]]';
  pick := coalesce(idx[1:least(greatest(shown, 0), coalesce(cardinality(idx), 0) / 3)], '{}');
  for i in 1 .. cardinality(chars) loop
    res := res || case when chars[i] !~ '[[:alnum:]]' or i = any(pick) then chars[i] else '_' end;
  end loop;
  return res;
end $$;

create or replace function ubbw.quiz_view(r ubbw.quiz_rounds, uid uuid) returns jsonb
language plpgsql stable as $$
declare q ubbw.quiz_questions; spots int := cardinality(ubbw.quiz_points()); solved int; mine jsonb; is_open boolean; third float;
begin
  select * into q from ubbw.quiz_questions where id = r.question_id;
  select count(*) into solved from ubbw.quiz_solves where slot = r.slot;
  select jsonb_build_object('rank', rank, 'points', points, 'ms', ms) into mine from ubbw.quiz_solves where slot = r.slot and user_id = uid;
  is_open := now() < r.closes_at and solved < spots;
  third := extract(epoch from r.closes_at - r.opens_at) / 3;
  return jsonb_build_object(
    'slot', r.slot, 'opensAt', ubbw.ms(r.opens_at), 'closesAt', ubbw.ms(r.closes_at),
    'open', is_open, 'question', q.question,
    'hint', ubbw.quiz_hint(q.answer, case when is_open then floor(extract(epoch from now() - r.opens_at) / third)::int else 0 end, r.slot),
    'answer', case when not is_open or mine is not null then q.answer end,
    'solved', solved, 'spots', spots, 'mine', mine,
    'winners', coalesce((select jsonb_agg(jsonb_build_object('rank', s.rank, 'name', p.name, 'ms', s.ms, 'points', s.points, 'me', s.user_id = uid) order by s.rank)
                         from ubbw.quiz_solves s join ubbw.profiles p on p.id = s.user_id where s.slot = r.slot), '[]'::jsonb));
end $$;

create or replace function ubbw.quiz_me(uid uuid) returns jsonb
language sql stable as $$
  with t as (select user_id, sum(points) pts, count(*) wins from ubbw.quiz_solves group by user_id)
  select jsonb_build_object('points', coalesce((select pts from t where user_id = uid), 0),
                            'wins', coalesce((select wins from t where user_id = uid), 0),
                            'rank', case when exists (select 1 from t where user_id = uid)
                                         then (select 1 + count(*) from t where pts > (select pts from t where user_id = uid)) end)
$$;

-- What's live now, the last round's result, and when the next question drops.
create or replace function public.app_quiz_now() returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare me ubbw.profiles := ubbw.me_or_fail(); len int := ubbw.quiz_len();
        s bigint := floor(extract(epoch from now()) / len)::bigint; r ubbw.quiz_rounds; prev ubbw.quiz_rounds; nxt bigint := s + 1;
begin
  r := ubbw.quiz_round(s);
  select * into prev from ubbw.quiz_rounds where slot < s order by slot desc limit 1;
  while nxt < s + 500 and not ubbw.quiz_slot_ok(nxt) loop nxt := nxt + 1; end loop;
  return jsonb_build_object(
    'now', ubbw.ms(now()),
    'nextAt', case when ubbw.quiz_slot_ok(nxt) then ubbw.ms(to_timestamp(nxt * len)) end,
    'everyMin', len / 60,
    'round', case when r.slot is not null then ubbw.quiz_view(r, me.id) end,
    'prev', case when prev.slot is not null then ubbw.quiz_view(prev, me.id) end,
    'me', ubbw.quiz_me(me.id));
end $$;

-- One guess. Right → the next free spot and its points; wrong → try again (one guess a second).
create or replace function public.app_quiz_guess(slot bigint, guess text) returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
#variable_conflict use_column
declare me ubbw.profiles := ubbw.me_or_fail(); r ubbw.quiz_rounds; q ubbw.quiz_questions; t ubbw.quiz_tries;
        g text := ubbw.quiz_norm(guess); pts int[] := ubbw.quiz_points(); n int; near int; took int;
begin
  if g = '' then perform ubbw.fail('Type an answer.'); end if;
  select * into r from ubbw.quiz_rounds where slot = app_quiz_guess.slot for update; -- one answer at a time per round: fair order
  if not found then perform ubbw.fail('No question right now.'); end if;
  if now() >= r.closes_at then perform ubbw.fail('Time''s up for this one.'); end if;
  if exists (select 1 from ubbw.quiz_solves where slot = r.slot and user_id = me.id) then perform ubbw.fail('You already got this one.'); end if;
  select count(*) into n from ubbw.quiz_solves where slot = r.slot;
  if n >= cardinality(pts) then perform ubbw.fail('All ' || cardinality(pts) || ' spots are taken. Next question soon.'); end if;
  insert into ubbw.quiz_tries (slot, user_id, tries, last_at) values (r.slot, me.id, 0, now() - interval '1 minute') on conflict do nothing;
  select * into t from ubbw.quiz_tries where slot = r.slot and user_id = me.id for update;
  if t.last_at > now() - interval '1 second' then perform ubbw.fail('One guess a second.'); end if;
  update ubbw.quiz_tries set tries = tries + 1, last_at = now() where slot = r.slot and user_id = me.id;
  select * into q from ubbw.quiz_questions where id = r.question_id;
  if g <> ubbw.quiz_norm(q.answer) and not exists (select 1 from unnest(q.also) x where ubbw.quiz_norm(x) = g) then
    select min(extensions.levenshtein(g, ubbw.quiz_norm(x))) into near from unnest(array[q.answer] || q.also) x;
    return jsonb_build_object('correct', false, 'close', length(g) >= 4 and near <= case when length(g) >= 8 then 2 else 1 end,
                              'round', ubbw.quiz_view(r, me.id));
  end if;
  took := (extract(epoch from now() - r.opens_at) * 1000)::int;
  insert into ubbw.quiz_solves (slot, user_id, rank, points, ms) values (r.slot, me.id, n + 1, pts[n + 1], took);
  insert into ubbw.ledger (user_id, amount, kind, reason, ref) values (me.id, pts[n + 1], 'game', 'Quiz Rush: #' || (n + 1) || ' to answer', 'quiz:' || r.slot);
  return ubbw.me_view(me.id) || jsonb_build_object('correct', true, 'rank', n + 1, 'points', pts[n + 1], 'ms', took,
                                                   'round', ubbw.quiz_view(r, me.id), 'quiz', ubbw.quiz_me(me.id));
end $$;

create or replace function public.app_quiz_board() returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare me ubbw.profiles := ubbw.me_or_fail();
begin
  return jsonb_build_object(
    'players', (select count(distinct user_id) from ubbw.quiz_solves),
    'me', ubbw.quiz_me(me.id),
    'top', coalesce((select jsonb_agg(jsonb_build_object('rank', x.pos, 'name', x.name, 'handle', x.handle, 'points', x.pts,
                                                         'wins', x.wins, 'me', x.id = me.id) order by x.pos, x.name) from (
              select p.id, p.name, p.handle, sum(s.points) pts, count(*) wins, rank() over (order by sum(s.points) desc) pos
              from ubbw.quiz_solves s join ubbw.profiles p on p.id = s.user_id
              group by p.id order by sum(s.points) desc limit 50) x), '[]'::jsonb));
end $$;

do $$
declare f record;
begin
  for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname in ('app_quiz_now', 'app_quiz_guess', 'app_quiz_board')
  loop
    execute format('revoke all on function %s from public, anon', f.sig);
    execute format('grant execute on function %s to authenticated', f.sig);
  end loop;
end $$;

-- ════════════════ the question bank ════════════════
-- Short typed answers. `also` lists other spellings people will type.
insert into ubbw.quiz_questions (question, answer, also)
select * from (values
  ('Who wrote the Bitcoin white paper?', 'Satoshi Nakamoto', '{satoshi,nakamoto}'::text[]),
  ('Bitcoin''s maximum supply, in millions of coins?', '21', '{21000000,"21 million",21m}'),
  ('The smallest unit of bitcoin is called a…?', 'satoshi', '{sat,sats,satoshis}'),
  ('In what year was the Bitcoin genesis block mined?', '2009', '{}'),
  ('In what year was the Bitcoin white paper published?', '2008', '{}'),
  ('Bitcoin white paper title: "Bitcoin: A Peer-to-Peer Electronic … System"', 'Cash', '{}'),
  ('The first block of a blockchain is called the … block?', 'genesis', '{}'),
  ('Genesis block headline: "Chancellor on brink of second bailout for …"', 'banks', '{bank}'),
  ('That genesis block headline came from which UK newspaper?', 'The Times', '{times}'),
  ('Which cypherpunk received the first ever bitcoin transaction?', 'Hal Finney', '{finney,hal}'),
  ('How many BTC were in that first transaction to Hal Finney?', '10', '{ten}'),
  ('In 2010, Laszlo Hanyecz paid 10,000 BTC for two of what?', 'pizzas', '{pizza}'),
  ('On what date is Bitcoin Pizza Day? (month and day)', 'May 22', '{"22 may","may 22nd","22nd may"}'),
  ('Roughly every how many minutes does Bitcoin add a block?', '10', '{ten}'),
  ('The Bitcoin block reward is cut in half every ~4 years. What is it called?', 'halving', '{halvening,halvings}'),
  ('How many BTC was the block reward when Bitcoin launched?', '50', '{fifty}'),
  ('After the 2024 halving, how many BTC is the block reward?', '3.125', '{}'),
  ('Around which year will the last bitcoin be mined?', '2140', '{}'),
  ('How many decimal places does bitcoin have?', '8', '{eight}'),
  ('How many decimal places does ether have?', '18', '{eighteen}'),
  ('Bitcoin''s mining difficulty adjusts every how many blocks?', '2016', '{}'),
  ('Which hash function does Bitcoin mining use?', 'SHA-256', '{sha256,sha2}'),
  ('Which elliptic curve does Bitcoin use for signatures?', 'secp256k1', '{}'),
  ('The number miners keep changing to find a valid block hash is the…?', 'nonce', '{}'),
  ('The tree that summarises all transactions in a block: … tree', 'Merkle', '{"merkle tree"}'),
  ('Unconfirmed Bitcoin transactions wait in the…?', 'mempool', '{"memory pool"}'),
  ('Bitcoin''s computing power is measured as its hash…?', 'rate', '{hashrate,power}'),
  ('Specialised chips built only for mining are called…?', 'ASIC', '{asics}'),
  ('Miners who combine hash power and share rewards join a mining…?', 'pool', '{pools}'),
  ('Proof of … is the consensus Bitcoin uses.', 'work', '{pow}'),
  ('Proof of … is the consensus Ethereum has used since 2022.', 'stake', '{pos}'),
  ('Bitcoin is often called digital…?', 'gold', '{}'),
  ('Bitcoin''s 2017 upgrade "SegWit" stands for Segregated…?', 'Witness', '{}'),
  ('Bitcoin''s 2021 upgrade that brought Schnorr signatures?', 'Taproot', '{}'),
  ('Ordinals inscribe data onto individual…?', 'satoshis', '{sats,satoshi,sat}'),
  ('The Ordinals-based token standard on Bitcoin is BRC-…?', '20', '{brc20}'),
  ('Bitcoin''s layer 2 for instant payments through channels?', 'Lightning', '{"lightning network",ln}'),
  ('In 2017 Bitcoin split, creating which coin?', 'Bitcoin Cash', '{bch}'),
  ('A permanent split of a blockchain into two chains is a hard…?', 'fork', '{}'),
  ('Spending the same coin twice is called double-…?', 'spending', '{spend,doublespending,doublespend}'),
  ('Controlling most of the hash power allows a …% attack.', '51', '{}'),
  ('Which country made bitcoin legal tender in 2021?', 'El Salvador', '{salvador}'),
  ('Michael Saylor''s company that buys bitcoin for its treasury?', 'MicroStrategy', '{strategy}'),
  ('BlackRock''s spot bitcoin ETF trades under which ticker?', 'IBIT', '{}'),
  ('In what year did US spot bitcoin ETFs start trading?', '2024', '{}'),
  ('What does ETF stand for?', 'exchange-traded fund', '{"exchange traded fund"}'),
  ('Wrapped bitcoin on Ethereum has which ticker?', 'WBTC', '{}'),
  ('Which Tokyo exchange collapsed in 2014 after losing ~850,000 BTC?', 'Mt. Gox', '{mtgox,"mount gox"}'),
  ('Which exchange founded by Sam Bankman-Fried collapsed in 2022?', 'FTX', '{}'),
  ('Who proposed Ethereum in a 2013 white paper?', 'Vitalik Buterin', '{vitalik,buterin}'),
  ('In what year did Ethereum mainnet launch?', '2015', '{}'),
  ('Ethereum''s first release in 2015 was codenamed…?', 'Frontier', '{}'),
  ('Ethereum''s 2022 move to proof of stake was nicknamed "The …"', 'Merge', '{"the merge"}'),
  ('In what year did The Merge happen?', '2022', '{}'),
  ('How many ETH does a solo validator need to stake?', '32', '{thirtytwo}'),
  ('The 2023 Shapella upgrade turned on staked ETH…?', 'withdrawals', '{withdrawal,withdraw,withdrawing}'),
  ('Ethereum''s 2024 upgrade that made rollups cheaper with "blobs"?', 'Dencun', '{cancundeneb}'),
  ('The fee unit for computation on Ethereum is called…?', 'gas', '{}'),
  ('The smallest unit of ether is called a…?', 'wei', '{}'),
  ('One billion wei is one…?', 'gwei', '{gigawei,shannon}'),
  ('EIP-1559 burns part of every Ethereum transaction''s … fee.', 'base', '{basefee}'),
  ('The most popular language for Ethereum smart contracts?', 'Solidity', '{}'),
  ('Vyper is a Python-like smart contract language for which chain?', 'Ethereum', '{eth,evm}'),
  ('The most used Ethereum client, written in Go?', 'Geth', '{goethereum}'),
  ('EIP stands for Ethereum Improvement…?', 'Proposal', '{}'),
  ('A normal user wallet on Ethereum is an externally owned…?', 'account', '{eoa}'),
  ('Smart-contract wallets (account abstraction) follow ERC-…?', '4337', '{erc4337}'),
  ('The standard for fungible tokens on Ethereum is ERC-…?', '20', '{erc20}'),
  ('The standard for NFTs on Ethereum is ERC-…?', '721', '{erc721}'),
  ('The multi-token standard on Ethereum is ERC-…?', '1155', '{erc1155}'),
  ('In 2016 Ethereum hard-forked after the hack of…?', 'The DAO', '{dao,thedao}'),
  ('The chain that kept Ethereum''s pre-DAO-fork history?', 'Ethereum Classic', '{etc}'),
  ('Ethereum''s main public testnet today?', 'Sepolia', '{}'),
  ('ENS names usually end in…?', '.eth', '{eth}'),
  ('ENS stands for Ethereum Name…?', 'Service', '{}'),
  ('Ethereum co-founder who went on to create Polkadot?', 'Gavin Wood', '{gavin,wood}'),
  ('Cardano founder and Ethereum co-founder?', 'Charles Hoskinson', '{hoskinson,charles}'),
  ('A program that runs on a blockchain is a smart…?', 'contract', '{contracts}'),
  ('A service that feeds real-world data to smart contracts is an…?', 'oracle', '{oracles}'),
  ('Which oracle network''s token is LINK?', 'Chainlink', '{}'),
  ('Etherscan is a block…?', 'explorer', '{}'),
  ('What does DeFi stand for?', 'decentralized finance', '{"decentralised finance"}'),
  ('What does NFT stand for?', 'non-fungible token', '{"non fungible token",nonfungibletokens}'),
  ('What does DAO stand for?', 'decentralized autonomous organization', '{"decentralised autonomous organisation","decentralized autonomous organisation","decentralised autonomous organization"}'),
  ('What does DEX stand for?', 'decentralized exchange', '{"decentralised exchange"}'),
  ('CEX stands for centralized…?', 'exchange', '{}'),
  ('KYC stands for know your…?', 'customer', '{client}'),
  ('What does P2P stand for?', 'peer to peer', '{peer-to-peer}'),
  ('TPS stands for transactions per…?', 'second', '{}'),
  ('In DeFi, what does TVL stand for?', 'total value locked', '{}'),
  ('What does ICO stand for?', 'initial coin offering', '{}'),
  ('CBDC stands for central bank digital…?', 'currency', '{currencies}'),
  ('In zk-proofs, what does zk stand for?', 'zero knowledge', '{zero-knowledge}'),
  ('MEV stands for maximal extractable…?', 'value', '{}'),
  ('AMM stands for automated market…?', 'maker', '{makers}'),
  ('Uniswap is a decentralized…?', 'exchange', '{dex}'),
  ('Aave and Compound let you lend and…?', 'borrow', '{borrowing}'),
  ('Liquidity providers can suffer … loss when prices move.', 'impermanent', '{}'),
  ('A loan borrowed and repaid within one transaction is a … loan.', 'flash', '{}'),
  ('A bot trading just before and after your swap does a … attack.', 'sandwich', '{}'),
  ('Locking tokens to secure a proof-of-stake chain and earn rewards?', 'staking', '{stake}'),
  ('A validator caught cheating loses stake. This is called…?', 'slashing', '{slash,slashed}'),
  ('Lido''s liquid staking token for ETH?', 'stETH', '{}'),
  ('Re-using staked ETH to secure other services is called…?', 'restaking', '{}'),
  ('Which protocol pioneered restaking on Ethereum?', 'EigenLayer', '{eigen}'),
  ('Sending tokens to an unspendable address to cut supply is called…?', 'burning', '{burn}'),
  ('A token that gives you votes in a protocol is a … token.', 'governance', '{}'),
  ('Free tokens sent to lots of wallets are called an…?', 'airdrop', '{airdrops}'),
  ('Developers vanishing with investors'' money is a rug…?', 'pull', '{rugpull}'),
  ('Optimistic and zero-knowledge are two kinds of…?', 'rollups', '{rollup}'),
  ('Arbitrum and Optimism are layer … networks.', '2', '{two,l2}'),
  ('Coinbase''s own layer 2 network is called…?', 'Base', '{}'),
  ('Which network''s token was MATIC, now POL?', 'Polygon', '{}'),
  ('Splitting a blockchain''s database into parallel pieces is called…?', 'sharding', '{shards}'),
  ('The blockchain trilemma: decentralization, security and…?', 'scalability', '{scaling,scale}'),
  ('Tools that move assets from one chain to another are called…?', 'bridges', '{bridge}'),
  ('The 2022 Ronin bridge hack hit which play-to-earn game?', 'Axie Infinity', '{axie}'),
  ('Which blockchain''s native token is SOL?', 'Solana', '{}'),
  ('Who founded Solana?', 'Anatoly Yakovenko', '{anatoly,yakovenko}'),
  ('Solana pairs proof of stake with a clock called proof of…?', 'history', '{}'),
  ('Solana smart contracts are mostly written in which language?', 'Rust', '{}'),
  ('Which blockchain''s native token is ADA?', 'Cardano', '{}'),
  ('Which blockchain''s native token is DOT?', 'Polkadot', '{}'),
  ('Which blockchain''s native token is AVAX?', 'Avalanche', '{}'),
  ('Which blockchain''s native token is ATOM?', 'Cosmos', '{}'),
  ('Which blockchain''s native token is TRX?', 'Tron', '{}'),
  ('BNB Chain was started by which exchange?', 'Binance', '{}'),
  ('Binance founder "CZ" is Changpeng…?', 'Zhao', '{}'),
  ('Coinbase CEO Brian…?', 'Armstrong', '{}'),
  ('IBC, how Cosmos chains talk, stands for Inter-Blockchain…?', 'Communication', '{}'),
  ('TON stands for The Open…?', 'Network', '{}'),
  ('Who created Litecoin?', 'Charlie Lee', '{charlie,lee}'),
  ('Litecoin adds a block about every how many minutes?', '2.5', '{"two and a half"}'),
  ('Monero is best known for what?', 'privacy', '{private,anonymity,anonymous}'),
  ('Zcash''s privacy proofs are called zk-…?', 'SNARKs', '{snark,zksnark,zksnarks}'),
  ('Ripple''s network token has which ticker?', 'XRP', '{}'),
  ('The 2013 meme coin with a dog logo?', 'Dogecoin', '{doge}'),
  ('Which Japanese dog breed is Dogecoin''s mascot?', 'Shiba Inu', '{shiba}'),
  ('Do Kwon founded which blockchain?', 'Terra', '{terraluna,luna}'),
  ('Terra''s algorithmic stablecoin that collapsed in 2022?', 'UST', '{terrausd}'),
  ('Meta''s abandoned stablecoin was first called…?', 'Libra', '{diem}'),
  ('A coin that tracks the price of a fiat currency is a …coin.', 'stable', '{stablecoin}'),
  ('Tether''s dollar stablecoin has which ticker?', 'USDT', '{tether}'),
  ('Circle''s dollar stablecoin has which ticker?', 'USDC', '{}'),
  ('Which protocol issues the DAI stablecoin?', 'MakerDAO', '{maker,sky}'),
  ('Real-world assets on-chain are shortened to…?', 'RWA', '{rwas}'),
  ('Turning a building or a bond into tokens is called…?', 'tokenization', '{tokenisation,tokenizing}'),
  ('A blockchain anyone can join is permissionless; one that needs approval is…?', 'permissioned', '{private}'),
  ('Your wallet''s secret recovery words are called a seed…?', 'phrase', '{seedphrase,mnemonic}'),
  ('Most seed phrases are 12 or how many words?', '24', '{twentyfour}'),
  ('"Not your keys, not your…"', 'coins', '{coin,crypto}'),
  ('A wallet kept offline is a … wallet.', 'cold', '{}'),
  ('A wallet connected to the internet is a … wallet.', 'hot', '{}'),
  ('Ledger and Trezor make … wallets.', 'hardware', '{}'),
  ('The string you share so people can send you crypto is your…?', 'address', '{wallet address,publickey}'),
  ('A wallet that needs several keys to sign is a multi-… wallet.', 'sig', '{multisig,signature,multisignature}'),
  ('Gnosis''s popular multisig wallet is now called…?', 'Safe', '{gnosissafe}'),
  ('MetaMask''s logo is which animal?', 'fox', '{}'),
  ('A fake site that steals your seed phrase is a … attack.', 'phishing', '{phish}'),
  ('"HODL" started as a misspelling of which word?', 'hold', '{}'),
  ('What does FUD stand for?', 'fear uncertainty and doubt', '{"fear uncertainty doubt"}'),
  ('FOMO: fear of missing…?', 'out', '{}'),
  ('WAGMI: we''re all gonna…?', 'make it', '{}'),
  ('What does ATH mean?', 'all-time high', '{"all time high"}'),
  ('What does "gm" mean on crypto Twitter?', 'good morning', '{}'),
  ('Sellers who panic have paper hands. Holders who never sell have … hands.', 'diamond', '{}'),
  ('Which artist''s NFT sold at Christie''s for $69 million in 2021?', 'Beeple', '{"mike winkelmann",winkelmann}'),
  ('Larva Labs'' 10,000 pixel-art NFTs from 2017?', 'CryptoPunks', '{punks,cryptopunk}'),
  ('Yuga Labs'' ape NFTs: Bored Ape … Club', 'Yacht', '{}'),
  ('The 2017 Ethereum game where you breed digital cats?', 'CryptoKitties', '{cryptokitty}'),
  ('IPFS stands for InterPlanetary File…?', 'System', '{}'),
  ('The capital city hosting UB Blockchain Week?', 'Ulaanbaatar', '{"ulan bator",ub,ulaanbaator}'),
  ('Mongolia''s currency, symbol ₮?', 'tugrik', '{tögrög,togrog,tugrug,tugrugs,tugriks,mnt}')
) v(question, answer, also)
where not exists (select 1 from ubbw.quiz_questions);
