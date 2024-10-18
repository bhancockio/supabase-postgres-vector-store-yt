"use client";

import { useState } from "react";

export default function AskQuestionPage() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);
    setAnswer(null);

    try {
      const response = await fetch("/api/ask-question", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ question }),
      });

      const data = await response.json();

      if (response.ok) {
        setAnswer(data.answer);
      } else {
        setErrorMessage(data.error || "Failed to get a response.");
      }
    } catch (error) {
      setErrorMessage("An unexpected error occurred.");
      console.error("Error submitting question:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto p-8 bg-white shadow-lg rounded-lg">
      <h1 className="text-3xl font-bold text-center text-gray-800 mb-6">
        Ask a Question
      </h1>
      <form onSubmit={handleSubmit}>
        <div className="mb-5">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Your Question:
          </label>
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            required
            className="w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            rows={4}
          />
        </div>
        <button
          type="submit"
          className="w-full py-3 bg-indigo-600 text-white font-semibold rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          disabled={isLoading}
        >
          {isLoading ? (
            <svg
              className="animate-spin h-5 w-5 mx-auto text-white"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              ></path>
            </svg>
          ) : (
            "Submit"
          )}
        </button>
      </form>

      {answer && (
        <div className="mt-6 p-4 bg-green-100 text-green-800 rounded-lg">
          <h2 className="text-lg font-semibold">Answer:</h2>
          <p>{answer}</p>
        </div>
      )}

      {errorMessage && (
        <p className="mt-6 text-center text-red-500">{errorMessage}</p>
      )}
    </div>
  );
}
