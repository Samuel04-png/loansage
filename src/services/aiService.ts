import { GoogleGenAI } from "@google/genai";
import type { Loan, Borrower } from '../types';

// Helper to get loan type category for AI context
function getLoanTypeCategory(loanType: string): string {
  const securedTypes = ['collateral_based', 'asset_financing', 'equipment', 'trade_finance', 'construction'];
  const unsecuredTypes = ['salary_based', 'personal_unsecured', 'education', 'medical', 'emergency', 'microfinance'];
  const conditionalTypes = ['sme_business', 'group', 'working_capital', 'invoice_financing', 'refinancing'];
  
  if (securedTypes.includes(loanType.toLowerCase())) return 'Secured';
  if (unsecuredTypes.includes(loanType.toLowerCase())) return 'Unsecured';
  if (conditionalTypes.includes(loanType.toLowerCase())) return 'Conditional';
  return 'Standard';
}

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
  
  const loanType = (loan as any).loanType || (loan as any).loan_type || 'Standard';
  const loanTypeInfo = loanType !== 'Standard' ? `\nLoan Type: ${loanType} (${getLoanTypeCategory(loanType)})` : '';
  
  const prompt = `
    Analyze this loan application for risk:
    Borrower: ${borrower.name} (Risk Score: ${borrower.riskScore}/100)
    Loan: ${loan.currency} ${loan.amount} for ${loan.durationMonths} months @ ${loan.interestRate}% interest.${loanTypeInfo}
    Collateral: ${loan.collateral && loan.collateral.length > 0 
      ? loan.collateral.map((c: any) => `${c.type} worth ${c.currency || 'ZMW'} ${c.value || c.estimated_value || 0}`).join(', ')
      : 'No collateral provided'}.
    
    Consider the loan type's specific risk profile and requirements. Calculate LTV if collateral exists. 
    Provide a verdict (APPROVE/REJECT/REVIEW) and 3 key reasons based on:
    1. Loan type appropriateness for borrower profile
    2. Risk factors specific to this loan type
    3. Overall creditworthiness assessment
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

