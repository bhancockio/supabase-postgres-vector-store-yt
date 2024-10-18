// app/api/ask-question/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import OpenAI from "openai";

// Initialize Supabase client
const supabase: SupabaseClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const { question } = await request.json();

    // Step 1: Convert the question into an embedding
    const openai = new OpenAI();
    const embeddingResponse = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: question,
    });

    const questionEmbedding = embeddingResponse.data[0].embedding;

    // Step 2: Search the vector store for relevant emails using similarity search
    const { data: matchingSections, error } = await supabase.rpc(
      "match_filtered_email_sections",
      {
        query_embedding: questionEmbedding,
        match_threshold: -0.3,
        match_count: 10, // Number of relevant emails to retrieve
        email_address: "brandon@gmail.com", // Add the filter for a specific email
      }
    );

    console.log("Matching sections:", matchingSections);

    if (error) throw new Error(error.message);

    // Combine the relevant sections into a single context
    const context = matchingSections
      .map((section: any) => section.section_content)
      .join("\n\n");

    console.log("Context:", context);

    // Step 3: Use OpenAI to generate a response using the relevant email content as context
    const aiResponse = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `To the best of your ability use the context to answer the question.`,
        },
        {
          role: "user",
          content: `Using the following information, to answer the question\n\n
          Context:\n
          ${context}\n\n
          Question:\n
          ${question}`,
        },
      ],
    });

    const answer = aiResponse.choices[0].message.content;

    return NextResponse.json({ answer }, { status: 200 });
  } catch (error: any) {
    console.error("Error in ask-question API:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate response" },
      { status: 500 }
    );
  }
}
