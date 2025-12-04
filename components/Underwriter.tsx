import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, Input, Button, Badge } from './ui/Base';
import { Send, Paperclip, Loader2, FileText, CheckCircle2, XCircle, Bot } from 'lucide-react';
import { chatWithUnderwriter, analyzeDocument } from '../services/aiService';
import { ChatMessage } from '../types';

export const Underwriter = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'Hello. I am the LoanSage Risk Officer. Upload a borrower document or ask me to evaluate a specific loan case.',
      timestamp: new Date()
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!inputValue.trim()) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    setIsLoading(true);

    // Convert messages to history format for Gemini
    const history = messages.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));

    const responseText = await chatWithUnderwriter(history, userMsg.content);

    const aiMsg: ChatMessage = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: responseText,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, aiMsg]);
    setIsLoading(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    
    // Add a system message about analyzing
    const sysMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'system',
      content: `Analyzing ${file.name}...`,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, sysMsg]);

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => {
        const base64Data = (reader.result as string).split(',')[1];
        const analysis = await analyzeDocument(base64Data, file.type);
        
        const aiMsg: ChatMessage = {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: `**Document Analysis for ${file.name}:**\n\n${analysis}`,
            timestamp: new Date()
        };
        setMessages(prev => [...prev, aiMsg]);
        setIsLoading(false);
    };
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-8rem)]">
      {/* Left Panel: Context/Tools */}
      <div className="lg:col-span-1 space-y-4 overflow-y-auto">
        <Card className="bg-gradient-to-br from-slate-900 to-slate-800 text-white border-none">
          <CardHeader>
            <CardTitle className="flex items-center text-lg">
                <Bot className="w-5 h-5 mr-2 text-primary-500" />
                AI Risk Engine
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-300 mb-4">
              Powered by DeepSeek / Gemini Advanced models. Capable of analyzing collateral images, reading NRCs, and calculating implicit risk scores.
            </p>
            <div className="space-y-2">
                <div className="flex items-center text-sm">
                    <CheckCircle2 className="w-4 h-4 mr-2 text-emerald-500" />
                    <span>LTV Calculation</span>
                </div>
                <div className="flex items-center text-sm">
                    <CheckCircle2 className="w-4 h-4 mr-2 text-emerald-500" />
                    <span>Identity Verification</span>
                </div>
                <div className="flex items-center text-sm">
                    <CheckCircle2 className="w-4 h-4 mr-2 text-emerald-500" />
                    <span>Fraud Detection</span>
                </div>
            </div>
          </CardContent>
        </Card>

        <Card>
            <CardHeader><CardTitle className="text-base">Quick Actions</CardTitle></CardHeader>
            <CardContent className="space-y-2">
                <Button variant="outline" className="w-full justify-start text-xs" onClick={() => setInputValue("Assess the risk of a K50,000 loan for a 2015 Toyota Corolla.")}>
                    Assess Vehicle Loan
                </Button>
                <Button variant="outline" className="w-full justify-start text-xs" onClick={() => setInputValue("Summarize the repayment history of Borrower #B_1.")}>
                    Check Repayment Health
                </Button>
                <Button variant="outline" className="w-full justify-start text-xs" onClick={() => fileInputRef.current?.click()}>
                    Analyze Document
                </Button>
            </CardContent>
        </Card>
      </div>

      {/* Right Panel: Chat Interface */}
      <Card className="lg:col-span-2 flex flex-col h-full shadow-md border-0 ring-1 ring-slate-200">
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-lg px-4 py-3 text-sm shadow-sm ${
                  msg.role === 'user'
                    ? 'bg-primary-600 text-white'
                    : msg.role === 'system' 
                    ? 'bg-slate-200 text-slate-600 italic text-xs text-center'
                    : 'bg-white text-slate-800 border border-slate-100'
                }`}
              >
                {msg.role === 'assistant' ? (
                    <div className="prose prose-sm max-w-none dark:prose-invert">
                        {msg.content.split('\n').map((line, i) => (
                            <p key={i} className="mb-1 last:mb-0">{line}</p>
                        ))}
                    </div>
                ) : (
                    msg.content
                )}
                <div className={`text-[10px] mt-1 ${msg.role === 'user' ? 'text-primary-100' : 'text-slate-400'}`}>
                  {msg.timestamp.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                </div>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        <div className="p-4 bg-white border-t border-slate-100">
          <div className="flex items-center space-x-2">
            <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="image/*,application/pdf"
                onChange={handleFileUpload}
            />
            <Button 
                variant="outline" 
                size="icon" 
                className="shrink-0 text-slate-500 hover:text-slate-700"
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading}
            >
              <Paperclip className="w-4 h-4" />
            </Button>
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !isLoading && handleSend()}
              placeholder="Ask the underwriter AI..."
              className="flex-1"
              disabled={isLoading}
            />
            <Button 
                onClick={handleSend} 
                disabled={isLoading || !inputValue.trim()} 
                className="shrink-0 bg-primary-600 hover:bg-primary-700"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};
