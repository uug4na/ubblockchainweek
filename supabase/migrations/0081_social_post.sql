-- The social group's like / comment / story steps are about one reel (owner, 25 Nov 2026):
-- https://www.instagram.com/reel/DgHIOywB2gd/  (the follow step keeps the profile link). Same as src/data/rewards.ts.
update ubbw.tasks set title = 'Like the UBBW reel',          href = 'https://www.instagram.com/reel/DgHIOywB2gd/' where id = 'like-post';
update ubbw.tasks set title = 'Comment on the UBBW reel',    href = 'https://www.instagram.com/reel/DgHIOywB2gd/' where id = 'comment-post';
update ubbw.tasks set title = 'Share the UBBW reel in your story', href = 'https://www.instagram.com/reel/DgHIOywB2gd/' where id = 'story-ubbw';
