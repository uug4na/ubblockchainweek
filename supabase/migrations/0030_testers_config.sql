-- 0029_security made testers config-driven (ubbw.config testers / testers_until) and replaced the
-- hard-coded list from 0029_tester_mnkhod, so the second tester goes into the config list here.
update ubbw.config set value = 'owner@example.com,tester@example.com' where key = 'testers';
