import { GoogleGenAI } from "@google/genai";
import type { Loan, Borrower } from '../types';

// Initialize Gemini Client
const ai = new GoogleGenAI({ apiKey: import.meta.env.GEMINI_API_KEY || import.meta.env.API_KEY || '' });

const SYSTEM_INSTRUCTION_UNDERWRITER = `
You are the TengaLoans AI Chief Risk Officer. Your goal is to analyze loan applications, borrower profiles, and collateral to assess risk.
Be professional, concise, and extremely prudent. 
Focus on:
1. Debt-to-Income ratios (inferred).
2. Collateral Loan-to-Value (LTV) ratios.
3. Behavioral risk indicators.
4. Compliance with microfinance best practices.
`;

export const analyzeLoanRisk = async (loan: Loan, borrower: Borrower): Promise<string> => {
  const model = "gemini-2.5-flash"; 
  
  const prompt = `
    Analyze this loan application for risk:
    Borrower: ${borrower.name} (Score: ${borrower.riskScore})
    Loan: ${loan.currency} ${loan.amount} for ${loan.durationMonths} months @ ${loan.interestRate}% interest.
    Collateral: ${loan.collateral.map(c => `${c.type} worth ${c.currency} ${c.value}`).join(', ')}.
    
    Calculate LTV. Provide a verdict (APPROVE/REJECT/REVIEW) and 3 key reasons.
  `;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION_UNDERWRITER,
        temperature: 0.2,
      }
    });
    return response.text || "Unable to generate analysis.";
  } catch (error) {
    console.error("AI Service Error:", error);
    return "AI Analysis unavailable due to connection error.";
  }
};

export const chatWithUnderwriter = async (
  history: { role: string; parts: [{ text: string }] }[],
  message: string
) => {
  try {
    const chat = ai.chats.create({
      model: 'gemini-2.5-flash',
      config: {
        systemInstruction: SYSTEM_INSTRUCTION_UNDERWRITER,
      },
      history: history as any,
    });

    const response = await chat.sendMessage({ message });
    return response.text;
  } catch (error) {
    console.error("Chat Error:", error);
    return "I am having trouble connecting to the risk engine. Please try again.";
  }
};

export const analyzeDocument = async (fileBase64: string, mimeType: string) => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType,
              data: fileBase64
            }
          },
          {
            text: "Extract the following from this document: Document Type, Person Name, ID Number, Expiry Date (if applicable), and a brief summary of the text content. Return as a clean Markdown list."
          }
        ]
      }
    });
    return response.text;
  } catch (error) {
    console.error("Doc Analysis Error:", error);
    return "Could not analyze document.";
  }
};

export const analyzeBorrowerProfile = async (borrower: Borrower, loans: Loan[]) => {
  const model = "gemini-2.5-flash";
  const prompt = `
    Generate a comprehensive Credit Risk Profile for this borrower:
    
    Name: ${borrower.name}
    NRC/ID: ${borrower.nrcNumber}
    Current Internal Risk Score: ${borrower.riskScore}/100
    
    Loan History:
    ${loans.length > 0 ? loans.map(l => `- ${l.currency} ${l.amount} (${l.status}), Repaid: ${l.repaymentProgress}%`).join('\n') : "No prior loan history."}
    
    Output:
    1. Summary of creditworthiness.
    2. Flagged risks based on repayment history (if any).
    3. Recommended maximum loan limit (ZMW).
    4. Suggested interest rate premium (Low/Medium/High).
    
    Format as clean Markdown.
  `;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION_UNDERWRITER,
        temperature: 0.3,
      }
    });
    return response.text;
  } catch (error) {
    console.error("Borrower Analysis Error:", error);
    return "Could not generate borrower profile.";
  }
};

