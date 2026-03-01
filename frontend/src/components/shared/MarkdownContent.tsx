"use client";

import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";

interface MarkdownContentProps {
    content: string;
    className?: string;
}

export function MarkdownContent({ content, className }: MarkdownContentProps) {
    return (
        <div
            className={cn(
                // Base prose styles matching the app's theme
                "prose prose-sm max-w-none",
                // Light mode
                "prose-headings:font-semibold prose-headings:text-foreground",
                "prose-p:text-foreground/80 prose-p:leading-relaxed",
                "prose-strong:text-foreground prose-strong:font-semibold",
                "prose-em:text-foreground/80",
                "prose-ul:text-foreground/80 prose-ol:text-foreground/80",
                "prose-li:marker:text-muted-foreground",
                "prose-code:text-foreground prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-xs prose-code:font-mono prose-code:before:content-none prose-code:after:content-none",
                "prose-pre:bg-muted prose-pre:text-foreground prose-pre:rounded-lg prose-pre:border prose-pre:border-border",
                "prose-blockquote:border-l-primary prose-blockquote:text-muted-foreground",
                "prose-a:text-primary prose-a:no-underline hover:prose-a:underline",
                "prose-hr:border-border",
                // Dark mode
                "dark:prose-headings:text-foreground",
                "dark:prose-p:text-foreground/80",
                "dark:prose-strong:text-foreground",
                "dark:prose-code:bg-muted",
                "dark:prose-pre:bg-muted",
                className
            )}
        >
            <ReactMarkdown>{content}</ReactMarkdown>
        </div>
    );
}
