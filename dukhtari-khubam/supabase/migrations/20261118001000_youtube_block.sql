-- Lessons can link a YouTube video: the block stores only the 11-character video id (props.video_id,
-- validated by the API's block schema), so no video file is kept in storage.
alter type public.block_type add value if not exists 'youtube' after 'video';
