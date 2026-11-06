-- Allow a club post author to edit their own publication.
-- Club administrators retain the ability to edit any post in their club.
drop policy if exists club_posts_update_admin on public.club_posts;
drop policy if exists club_posts_update_admin_or_author on public.club_posts;
create policy club_posts_update_admin_or_author
on public.club_posts
for update
to authenticated
using (
  created_by = (select auth.uid())
  or exists (
    select 1 from public.club_members cm
    where cm.club_id = club_posts.club_id
      and cm.user_id = (select auth.uid())
      and cm.role = 'admin'
  )
)
with check (
  created_by = (select auth.uid())
  or exists (
    select 1 from public.club_members cm
    where cm.club_id = club_posts.club_id
      and cm.user_id = (select auth.uid())
      and cm.role = 'admin'
  )
);
