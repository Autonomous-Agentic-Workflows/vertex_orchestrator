
import React, { useState, useCallback } from 'react';
import { reviewCode } from './services/geminiService';

const CodeIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
    </svg>
);

const SparklesIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m11-13v4m-2-2h4m2 11h-4m2 2v-4M12 2v2m-2-2h4m2 18h-4m2 2v-2m-8-8a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
);

const LoadingSpinner = () => (
    <div className="flex justify-center items-center h-full">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500"></div>
    </div>
);

const App = () => {
    const [code, setCode] = useState<string>('');
    const [review, setReview] = useState<string>('');
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string>('');

    const handleReviewRequest = useCallback(async () => {
        if (!code.trim()) {
            setError('Please enter some code to review.');
            return;
        }
        setIsLoading(true);
        setError('');
        setReview('');
        try {
            const result = await reviewCode(code);
            setReview(result);
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred.';
            setError(errorMessage);
        } finally {
            setIsLoading(false);
        }
    }, [code]);

    const placeholderText = `Your AI-powered code review will appear here.

The review will cover:
- Overall Summary
- Code Quality & Best Practices
- Potential Bugs & Logic Errors
- Security Vulnerabilities
- Performance Improvements
- Suggestions for Improvement
`;

    return (
        <div className="min-h-screen bg-gray-900 text-gray-200 font-sans p-4 sm:p-6 lg:p-8">
            <div className="max-w-7xl mx-auto">
                <header className="text-center mb-8">
                    <h1 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight">
                        <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-teal-400">
                            Gemini Code Reviewer
                        </span>
                    </h1>
                    <p className="mt-2 text-lg text-gray-400">
                        AI-powered feedback for <span className="font-mono bg-gray-800 px-2 py-1 rounded">BTCRecover-Master</span> code.
                    </p>
                </header>

                <main className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Code Input Section */}
                    <div className="flex flex-col space-y-4">
                        <div className="flex items-center space-x-2">
                            <CodeIcon />
                            <h2 className="text-2xl font-bold text-gray-100">Your Code</h2>
                        </div>
                        <div className="bg-gray-800 rounded-lg p-1 flex-grow flex flex-col shadow-lg">
                            <textarea
                                value={code}
                                onChange={(e) => setCode(e.target.value)}
                                placeholder="Paste your Python code here..."
                                className="w-full h-full flex-grow bg-gray-800 text-gray-300 font-mono p-4 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                                rows={20}
                                spellCheck="false"
                            />
                        </div>
                        <button
                            onClick={handleReviewRequest}
                            disabled={isLoading}
                            className="w-full flex justify-center items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-500 disabled:cursor-not-allowed transition-colors duration-200"
                        >
                            {isLoading ? 'Reviewing...' : 'Review Code'}
                        </button>
                    </div>

                    {/* Review Output Section */}
                    <div className="flex flex-col space-y-4">
                        <div className="flex items-center space-x-2">
                            <SparklesIcon />
                            <h2 className="text-2xl font-bold text-gray-100">AI Review</h2>
                        </div>
                        <div className="bg-gray-800 rounded-lg p-4 flex-grow shadow-lg min-h-[400px] lg:min-h-0">
                            {isLoading ? (
                                <LoadingSpinner />
                            ) : error ? (
                                <div className="text-red-400 bg-red-900/50 p-4 rounded-md h-full">
                                    <h3 className="font-bold mb-2">Error</h3>
                                    <p>{error}</p>
                                </div>
                            ) : (
                                <div className="prose prose-invert max-w-none h-full overflow-y-auto">
                                    <pre className="text-gray-300 whitespace-pre-wrap font-sans text-sm leading-relaxed">
                                        {review || placeholderText}
                                    </pre>
                                </div>
                            )}
                        </div>
                    </div>
                </main>

                <footer className="text-center mt-12 text-gray-500 text-sm">
                    <p>Powered by Google Gemini. This is a tool for analysis and does not guarantee correctness.</p>
                </footer>
            </div>
        </div>
    );
};

export default App;
