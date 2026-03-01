
"use client";

import React from "react";
import Editor from "@monaco-editor/react";
import { Loader2 } from "lucide-react";

interface ResumeEditorProps {
    value: string;
    onChange: (value: string | undefined) => void;
    readOnly?: boolean;
}

export function ResumeEditor({ value, onChange, readOnly = false }: ResumeEditorProps) {
    // const { theme } = useTheme();

    return (
        <div className="h-full w-full border rounded-md overflow-hidden bg-background">
            <Editor
                height="100%"
                defaultLanguage="yaml"
                value={value}
                onChange={onChange}
                theme="vs-dark"
                options={{
                    minimap: { enabled: false },
                    fontSize: 14,
                    lineNumbers: "on",
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                    readOnly: readOnly,
                    wordWrap: "on"
                }}
                loading={
                    <div className="flex items-center justify-center h-full">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                }
            />
        </div>
    );
}
