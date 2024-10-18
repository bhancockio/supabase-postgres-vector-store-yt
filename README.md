-- Ensure the pgvector extension is enabled.
CREATE EXTENSION IF NOT EXISTS vector;

-- Create the emails table.
CREATE TABLE emails (
id SERIAL PRIMARY KEY, -- Unique ID for each email
subject TEXT NOT NULL, -- Subject of the email
sender TEXT NOT NULL, -- Email address of the sender
recipient TEXT[] NOT NULL, -- Array of recipients
cc TEXT[], -- Optional CC recipients
bcc TEXT[], -- Optional BCC recipients
body TEXT NOT NULL, -- Full body of the email (raw content)
created_at TIMESTAMPTZ DEFAULT NOW() -- Timestamp when the email was sent or received
);

-- Create the email_sections table.
CREATE TABLE email_sections (
id SERIAL PRIMARY KEY, -- Unique ID for each section
email_id INT NOT NULL REFERENCES emails(id) ON DELETE CASCADE, -- Reference to parent email
section_content TEXT NOT NULL, -- Content of the section (chunk)
embedding VECTOR(1536), -- Embedding of the section
section_order INT, -- Order of the section in the original email
created_at TIMESTAMPTZ DEFAULT NOW() -- Timestamp for the section
);

-- Create an HNSW index on the section embeddings using the correct operator class.
CREATE INDEX section_embedding_hnsw_idx
ON email_sections USING hnsw (embedding vector_cosine_ops);

-- Function: match_filtered_email_sections
-- Description: This function retrieves relevant email sections based on a similarity search
-- using a vector embedding and allows filtering by the sender or recipient email address.

create or replace function match_filtered_email_sections(
query_embedding vector(1536), -- Input: The embedding vector generated from the user's question (1536 dimensions for ADA-002).
match_threshold float, -- Input: Minimum similarity threshold (only sections with similarity above this will be returned).
match_count int, -- Input: Maximum number of results to return.
email_address text -- Input: The email address used to filter by sender or recipient.
)
returns table (
id int, -- Output: Unique ID of the email section.
email_id int, -- Output: ID of the parent email (used to reference the full email).
section_content text, -- Output: The content of the matching email section (a chunk of the email).
similarity float -- Output: Similarity score between the query embedding and the section embedding.
)
language sql
as $$
-- Core SQL query to perform the similarity search and filter results.
select
es.id, -- Select the ID of the email section.
es.email_id, -- Select the ID of the parent email to which this section belongs.
es.section_content, -- Select the content of the section (chunk of the email).
1 - (es.embedding <-> query_embedding) as similarity -- Calculate similarity score: 1 minus the cosine distance.

from
email_sections es -- From the email sections table (contains all the email chunks with their embeddings).
join
emails e on es.email_id = e.id -- Join with the emails table to access sender and recipient information.

where
-- Filter by sender or recipient: Only retrieve sections where the sender or recipient matches the given email address.
(e.sender = email_address or e.recipient @> array[email_address])

    -- Apply the similarity threshold: Only return sections with a similarity score greater than the threshold.
    and (1 - (es.embedding <-> query_embedding)) > match_threshold

order by
similarity desc -- Order the results by similarity in descending order (most similar first).

limit
least(match_count, 200); -- Limit the number of results to the smaller of match_count or 200 to prevent large queries.

$$
;


SELECT *
FROM pg_proc
WHERE proname = 'match_filtered_email_sections';


SELECT nspname AS schema_name, proname AS function_name
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE proname = 'match_filtered_email_sections';
$$
