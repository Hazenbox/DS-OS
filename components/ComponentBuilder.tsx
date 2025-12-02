import React, { useState, useEffect } from 'react';
import { ComponentItem, Token } from '../types';
import { generateComponentCode, generateDocumentation } from '../services/geminiService';
import { Send, Zap, Code, FileText, Loader2, Play } from 'lucide-react';

interface BuilderProps {
    components: ComponentItem[];
    setComponents: React.Dispatch<React.SetStateAction<ComponentItem[]>>;
    tokens: Token[];
}

export const ComponentBuilder: React.FC<BuilderProps> = ({ components, setComponents, tokens }) => {
    const [selectedComponent, setSelectedComponent] = useState<ComponentItem | null>(null);
    const [prompt, setPrompt] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [activeTab, setActiveTab] = useState<'preview' | 'code' | 'docs'>('code');

    const handleCreateNew = () => {
        const newComp: ComponentItem = {
            id: Date.now().toString(),
            name: 'New Component',
            status: 'draft',
            version: '0.0.1',
            code: '// Generated code will appear here',
            docs: 'Documentation pending...'
        };
        setComponents([...components, newComp]);
        setSelectedComponent(newComp);
    };

    const handleGenerate = async () => {
        if (!selectedComponent) return;
        
        setIsGenerating(true);
        try {
            const code = await generateComponentCode(prompt, tokens, selectedComponent.code);
            const docs = await generateDocumentation(code);
            
            const updated = { ...selectedComponent, code, docs, name: prompt.split(' ')[0] || selectedComponent.name };
            
            setComponents(prev => prev.map(c => c.id === updated.id ? updated : c));
            setSelectedComponent(updated);
            setPrompt('');
        } catch (e) {
            alert('Generation failed. Please check API Key.');
        } finally {
            setIsGenerating(false);
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
                    <button onClick={handleCreateNew} className="text-xs bg-bg-inverse text-inverse px-2 py-1.5 rounded font-medium hover:opacity-90">
                        + New
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto">
                    {components.map(c => (
                        <div 
                            key={c.id} 
                            onClick={() => setSelectedComponent(c)}
                            className={`p-4 border-b border-border cursor-pointer hover:bg-surface/50 ${selectedComponent?.id === c.id ? 'bg-surface border-l-2 border-l-primary' : ''}`}
                        >
                            <div className="font-medium text-sm text-primary">{c.name}</div>
                            <div className="flex justify-between mt-1">
                                <span className={`text-[10px] uppercase px-1.5 py-0.5 rounded ${c.status === 'stable' ? 'bg-green-500/10 text-green-600' : 'bg-yellow-500/10 text-yellow-600'}`}>
                                    {c.status}
                                </span>
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
                             <span className="text-xs text-muted">Auto-save on</span>
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