import React, { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../convex/_generated/api';
import { Id } from '../convex/_generated/dataModel';
import { Token, ConvexComponent } from '../types';
import { generateComponentCode, generateDocumentation } from '../services/geminiService';
import { Send, Zap, Code, FileText, Loader2, Trash2 } from 'lucide-react';

interface BuilderProps {
    tokens: Token[];
}

export const ComponentBuilder: React.FC<BuilderProps> = ({ tokens }) => {
    const [selectedComponentId, setSelectedComponentId] = useState<Id<"components"> | null>(null);
    const [prompt, setPrompt] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [activeTab, setActiveTab] = useState<'preview' | 'code' | 'docs'>('code');

    // Convex queries
    const components = useQuery(api.components.list, {});

    // Convex mutations
    const createComponent = useMutation(api.components.create);
    const updateComponent = useMutation(api.components.update);
    const removeComponent = useMutation(api.components.remove);

    const selectedComponent = components?.find(c => c._id === selectedComponentId) || null;

    const handleCreateNew = async () => {
        try {
            const newId = await createComponent({
                name: 'New Component',
                status: 'draft',
                version: '0.0.1',
                code: '// Generated code will appear here',
                docs: 'Documentation pending...'
            });
            setSelectedComponentId(newId);
        } catch (error) {
            console.error('Failed to create component:', error);
        }
    };

    const handleDelete = async (id: Id<"components">) => {
        try {
            await removeComponent({ id });
            if (selectedComponentId === id) {
                setSelectedComponentId(null);
            }
        } catch (error) {
            console.error('Failed to delete component:', error);
        }
    };

    const handleGenerate = async () => {
        if (!selectedComponent) return;
        
        setIsGenerating(true);
        try {
            const code = await generateComponentCode(prompt, tokens, selectedComponent.code);
            const docs = await generateDocumentation(code);
            
            // Extract component name from prompt
            const newName = prompt.split(' ').find(word => 
                word.length > 2 && word[0] === word[0].toUpperCase()
            ) || selectedComponent.name;
            
            await updateComponent({
                id: selectedComponent._id,
                code,
                docs,
                name: newName
            });
            
            setPrompt('');
        } catch (e) {
            alert('Generation failed. Please check API Key.');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleStatusChange = async (id: Id<"components">, status: ConvexComponent['status']) => {
        try {
            await updateComponent({ id, status });
        } catch (error) {
            console.error('Failed to update status:', error);
        }
    };

    return (
        <div className="flex h-full overflow-hidden">
            {/* Left Panel: List & Controls */}
            <div className="w-80 border-r border-border flex flex-col bg-surface/30">
                <div className="p-6 border-b border-border flex justify-between items-center bg-background">
                    <div>
                        <h2 className="text-xl font-semibold text-primary">Builder</h2>
                        <p className="text-sm text-muted">AI-powered generation.</p>
                    </div>
                    <button 
                        onClick={handleCreateNew} 
                        className="text-xs bg-bg-inverse text-inverse px-2 py-1.5 rounded font-medium hover:opacity-90"
                    >
                        + New
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto">
                    {components?.map(c => (
                        <div 
                            key={c._id} 
                            onClick={() => setSelectedComponentId(c._id)}
                            className={`p-4 border-b border-border cursor-pointer hover:bg-surface/50 group ${selectedComponentId === c._id ? 'bg-surface border-l-2 border-l-primary' : ''}`}
                        >
                            <div className="flex justify-between items-start">
                                <div className="font-medium text-sm text-primary">{c.name}</div>
                                <button 
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleDelete(c._id);
                                    }}
                                    className="opacity-0 group-hover:opacity-100 text-muted hover:text-red-500 p-1"
                                >
                                    <Trash2 size={12} />
                                </button>
                            </div>
                            <div className="flex justify-between mt-1">
                                <select
                                    value={c.status}
                                    onChange={(e) => {
                                        e.stopPropagation();
                                        handleStatusChange(c._id, e.target.value as ConvexComponent['status']);
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                    className={`text-[10px] uppercase px-1.5 py-0.5 rounded bg-transparent border-none cursor-pointer ${
                                        c.status === 'stable' ? 'text-green-600' : 
                                        c.status === 'review' ? 'text-yellow-600' : 
                                        c.status === 'deprecated' ? 'text-red-600' : 'text-zinc-500'
                                    }`}
                                >
                                    <option value="draft">Draft</option>
                                    <option value="review">Review</option>
                                    <option value="stable">Stable</option>
                                    <option value="deprecated">Deprecated</option>
                                </select>
                                <span className="text-xs text-muted font-mono">v{c.version}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Middle Panel: Editor/Preview */}
            {selectedComponent ? (
                <div className="flex-1 flex flex-col bg-surface">
                    {/* Header Tabs */}
                    <div className="h-14 border-b border-border flex items-center px-4 justify-between bg-background">
                        <div className="flex gap-4 h-full">
                            <button 
                                onClick={() => setActiveTab('code')}
                                className={`text-sm flex items-center gap-2 px-2 border-b-2 transition-colors ${activeTab === 'code' ? 'border-primary text-primary' : 'border-transparent text-muted hover:text-primary'}`}
                            >
                                <Code size={14} /> Code
                            </button>
                            <button 
                                onClick={() => setActiveTab('docs')}
                                className={`text-sm flex items-center gap-2 px-2 border-b-2 transition-colors ${activeTab === 'docs' ? 'border-primary text-primary' : 'border-transparent text-muted hover:text-primary'}`}
                            >
                                <FileText size={14} /> Docs
                            </button>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-green-500"></div>
                            <span className="text-xs text-muted">Synced to Convex</span>
                        </div>
                    </div>

                    {/* Main Content */}
                    <div className="flex-1 overflow-hidden flex flex-col relative">
                        {activeTab === 'code' && (
                             <textarea 
                                className="w-full h-full bg-surface text-primary font-mono text-sm p-6 resize-none focus:outline-none leading-relaxed"
                                value={selectedComponent.code}
                                readOnly
                            />
                        )}
                        {activeTab === 'docs' && (
                            <div className="p-8 prose prose-invert max-w-none overflow-y-auto">
                                <pre className="whitespace-pre-wrap font-sans text-primary">{selectedComponent.docs}</pre>
                            </div>
                        )}

                        {/* Prompt Overlay (Bottom) */}
                        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-background via-background to-transparent pt-12">
                            <div className="max-w-3xl mx-auto bg-surface border border-border rounded-lg shadow-2xl p-2 flex gap-2 items-end">
                                <textarea
                                    className="flex-1 bg-transparent border-none focus:ring-0 text-sm text-primary max-h-32 min-h-[44px] py-3 px-2 resize-none placeholder:text-muted"
                                    placeholder="Describe changes (e.g., 'Add a primary variant using blue token')..."
                                    value={prompt}
                                    onChange={(e) => setPrompt(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            handleGenerate();
                                        }
                                    }}
                                />
                                <button 
                                    onClick={handleGenerate}
                                    disabled={isGenerating || !prompt.trim()}
                                    className="h-9 w-9 flex items-center justify-center bg-bg-inverse text-inverse rounded hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors mb-1"
                                >
                                    {isGenerating ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="flex-1 flex items-center justify-center text-muted flex-col gap-4 bg-surface/50">
                    <div className="w-16 h-16 rounded-full bg-surface border border-border flex items-center justify-center">
                        <Zap size={24} />
                    </div>
                    <p>Select a component or create new to start building</p>
                </div>
            )}
        </div>
    );
};
