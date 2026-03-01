
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { contextService, UserContextItem } from '@/services/context.service';

interface IngestContextProps {
    onIngestComplete: (newItems: UserContextItem[]) => void;
}

export function IngestContext({ onIngestComplete }: IngestContextProps) {
    const [text, setText] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleIngest = async () => {
        if (!text.trim()) return;

        setLoading(true);
        setError(null);
        try {
            const items = await contextService.ingest(text);
            setText('');
            onIngestComplete(items);
        } catch (err: any) {
            console.error(err);
            setError('Failed to ingest context. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Auto-Extract Context</CardTitle>
                <CardDescription>
                    Paste your resume, bio, or any text here. We'll extract key facts into your profile.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Textarea
                    placeholder="Paste text here..."
                    className="min-h-[150px]"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                />
                {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
            </CardContent>
            <CardFooter className="flex justify-end">
                <Button onClick={handleIngest} disabled={loading || !text.trim()}>
                    {loading ? 'Analyzing...' : 'Extract & Save'}
                </Button>
            </CardFooter>
        </Card>
    );
}
