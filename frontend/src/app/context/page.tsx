
"use client";

import { ContextManager } from "@/components/context/ContextManager";
import { CommandCenter } from "@/components/layout/CommandCenter";

export default function ContextPage() {
  return (
    <CommandCenter>
        <div className="flex flex-col space-y-6">
            <div className="flex items-center justify-between">
                 <div>
                    <h1 className="text-3xl font-bold tracking-tight">Context Management</h1>
                     <p className="text-muted-foreground mt-1">
                         Manage your "My Info" data. The AI uses this global context to tailor resumes and simulate interviews.
                    </p>
                </div>
            </div>
            
            <ContextManager />
        </div>
    </CommandCenter>
  );
}
