// app/api/store-email/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import { z } from "zod";

// Define the types for your email and sections
interface Email {
  subject: string;
  sender: string;
  recipient: string[];
  cc?: string[];
  bcc?: string[];
  body: string;
}

interface EmailSection {
  email_id: number;
  section_content: string;
  embedding: number[];
  section_order: number;
}

// Initialize Supabase Client
const supabase: SupabaseClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Define the schema for the Email object
const emailSchema = z.object({
  subject: z.string(),
  sender: z.string().email(),
  recipient: z.array(z.string().email()),
  cc: z.array(z.string().email()).optional(),
  bcc: z.array(z.string().email()).optional(),
  body: z.string(),
});

// Function to split the email body into chunks
function splitIntoChunks(text: string, chunkSize: number = 2000): string[] {
  const words = text.split(" ");
  const chunks: string[] = [];
  let currentChunk = "";

  for (const word of words) {
    if (currentChunk.length + word.length + 1 > chunkSize) {
      chunks.push(currentChunk);
      currentChunk = word;
    } else {
      currentChunk += (currentChunk ? " " : "") + word;
    }
  }

  if (currentChunk) chunks.push(currentChunk);

  return chunks;
}

// POST handler
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    console.log("Received a POST request");

    const requestData = await request.json();
    console.log("Request data parsed:", requestData);

    // Validate the request data using zod
    const validationResult = emailSchema.safeParse(requestData);
    console.log("Validation result:", validationResult);

    if (!validationResult.success) {
      console.error("Validation failed:", validationResult.error.errors);
      return NextResponse.json(
        { error: "Invalid email data", details: validationResult.error.errors },
        { status: 400 }
      );
    }

    const { subject, sender, recipient, cc, bcc, body }: Email =
      validationResult.data;
    console.log("Email data validated and extracted");

    // Step 1: Store the root email in the database
    const { data: email, error: emailError } = await supabase
      .from("emails")
      .insert([{ subject, sender, recipient, cc, bcc, body }])
      .select("id")
      .single();
    console.log("Email inserted into database:", email);

    if (emailError) {
      console.error("Error inserting email:", emailError.message);
      throw new Error(emailError.message);
    }

    const emailId: number = email.id;
    console.log("Email ID:", emailId);

    // Step 2: Split the email body into smaller chunks
    const chunks = splitIntoChunks(body);
    console.log("Email body split into chunks:", chunks);

    // Step 3: Embed each chunk and store it in the database
    // Initialize OpenAI Client
    const openai = new OpenAI();
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      console.log(`Processing chunk ${i + 1}/${chunks.length}:`, chunk);

      const embeddingResponse = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: chunk,
      });
      console.log("Embedding response received:", embeddingResponse);

      const embedding = embeddingResponse.data[0].embedding;
      console.log("Embedding extracted:", embedding);

      const section: EmailSection = {
        email_id: emailId,
        section_content: chunk,
        embedding,
        section_order: i + 1,
      };

      const { error: sectionError } = await supabase
        .from("email_sections")
        .insert([section]);
      console.log("Section inserted into database:", section);

      if (sectionError) {
        console.error("Error inserting section:", sectionError.message);
        throw new Error(sectionError.message);
      }
    }

    console.log("Email stored successfully!");
    return NextResponse.json(
      { message: "Email stored successfully!" },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Error storing email:", error);
    return NextResponse.json(
      { error: error.message || "Failed to store email" },
      { status: 500 }
    );
  }
}
