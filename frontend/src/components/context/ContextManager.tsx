
import React, { useEffect, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger
} from '@/components/ui/dialog';
import { contextService, UserContextItem } from '@/services/context.service';
import { IngestContext } from './IngestContext';
import { Trash2, Edit2, Plus } from 'lucide-react';

const CATEGORIES = ['professional', 'personal', 'preferences', 'skills', 'general'];

export function ContextManager() {
    const [items, setItems] = useState<UserContextItem[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchItems = async () => {
        setLoading(true);
        try {
            const data = await contextService.getAll();
            setItems(data);
        } catch (error) {
            console.error("Failed to fetch context", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchItems();
    }, []);

    const handleIngestComplete = (newItems: UserContextItem[]) => {
        // Merge or refetch
        fetchItems();
    };

    const handleDelete = async (key: string) => {
        if (!confirm('Are you sure you want to delete this item?')) return;
        try {
            await contextService.delete(key);
            setItems(items.filter(i => i.key !== key));
        } catch (error) {
            console.error("Failed to delete", error);
        }
    };

    const handleUpdate = async (key: string, data: Partial<UserContextItem>) => {
        try {
            const updated = await contextService.update(key, data);
            setItems(items.map(i => i.key === key ? updated : i));
        } catch (error) {
            console.error("Failed to update", error);
        }
    };

    const handleCreate = async (data: any) => {
        try {
            const created = await contextService.create(data);
            setItems([...items, created]);
        } catch (error) {
            console.error("Failed to create", error);
            alert("Failed to create item. Key must be unique.");
        }
    }

    return (
        <div className="space-y-6">
            <IngestContext onIngestComplete={handleIngestComplete} />

            <Card>
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <div>
                            <CardTitle>My Context</CardTitle>
                            <CardDescription>
                                Manage the global facts that ResuMate knows about you.
                            </CardDescription>
                        </div>
                        <EditItemDialog isNew={true} onSave={handleCreate} />
                    </div>
                </CardHeader>
                <CardContent>
                    <Tabs defaultValue="professional" className="w-full">
                        <TabsList className="mb-4">
                            {CATEGORIES.map(cat => (
                                <TabsTrigger key={cat} value={cat} className="capitalize">
                                    {cat}
                                </TabsTrigger>
                            ))}
                        </TabsList>

                        {CATEGORIES.map(cat => (
                            <TabsContent key={cat} value={cat}>
                                <CategoryList
                                    items={items.filter(i => i.category === cat)}
                                    onDelete={handleDelete}
                                    onUpdate={handleUpdate}
                                />
                            </TabsContent>
                        ))}
                    </Tabs>
                </CardContent>
            </Card>
        </div>
    );
}

function CategoryList({ items, onDelete, onUpdate }: { items: UserContextItem[], onDelete: (key: string) => void, onUpdate: (key: string, data: Partial<UserContextItem>) => void }) {
    if (items.length === 0) {
        return <div className="text-center py-8 text-muted-foreground">No items in this category.</div>;
    }

    return (
        <div className="space-y-4">
            {items.map(item => (
                <div key={item.key} className="flex items-start justify-between p-4 border rounded-lg bg-card text-card-foreground shadow-sm">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2">
                            <span className="font-mono text-sm font-semibold bg-muted px-2 py-0.5 rounded text-muted-foreground">
                                {item.key}
                            </span>
                            {item.description && (
                                <span className="text-xs text-muted-foreground italic">
                                    - {item.description}
                                </span>
                            )}
                        </div>
                        <p className="text-sm whitespace-pre-wrap">{item.value}</p>
                    </div>
                    <div className="flex gap-2 ml-4">
                        <EditItemDialog item={item} onSave={(data) => onUpdate(item.key, data)} />
                        <Button variant="ghost" size="icon" onClick={() => onDelete(item.key)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                    </div>
                </div>
            ))}
        </div>
    );
}

function EditItemDialog({ item, isNew, onSave }: { item?: UserContextItem, isNew?: boolean, onSave: (data: any) => void }) {
    const [open, setOpen] = useState(false);
    const [formData, setFormData] = useState({
        key: item?.key || '',
        value: item?.value || '',
        category: item?.category || 'general',
        description: item?.description || ''
    });

    const handleSave = () => {
        onSave(formData);
        setOpen(false);
        if (isNew) {
            setFormData({ key: '', value: '', category: 'general', description: '' });
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {isNew ? (
                    <Button size="sm"><Plus className="h-4 w-4 mr-2" /> Add Item</Button>
                ) : (
                    <Button variant="ghost" size="icon">
                        <Edit2 className="h-4 w-4" />
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{isNew ? "Add Context Item" : "Edit Item"}</DialogTitle>
                    <DialogDescription>
                        Key facts about you used for generating content.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label>Key (snake_case)</Label>
                        <Input
                            value={formData.key}
                            onChange={e => setFormData({ ...formData, key: e.target.value })}
                            disabled={!isNew}
                            placeholder="e.g. years_of_experience"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Category</Label>
                        <select
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            value={formData.category}
                            onChange={e => setFormData({ ...formData, category: e.target.value })}
                        >
                            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                    <div className="space-y-2">
                        <Label>Value</Label>
                        <Textarea
                            value={formData.value}
                            onChange={e => setFormData({ ...formData, value: e.target.value })}
                            className="min-h-[100px]"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Description (Optional)</Label>
                        <Input
                            value={formData.description || ''}
                            onChange={e => setFormData({ ...formData, description: e.target.value })}
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                    <Button onClick={handleSave}>Save</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
